/**
 * File-system path security.
 *
 * The allow-list + symlink-resolution logic that every file tool (read,
 * write, list, search, image, pdf, ...) gates on before touching disk.
 * Extracted from file-system.ts so the security layer is reviewable and
 * testable on its own, separate from the tool definitions.
 *
 * Threat model addressed here:
 * - path traversal out of the workspace (`../../etc/passwd`)
 * - symlink escapes, including symlinked PARENT directories of files that
 *   do not exist yet (create/write/move targets)
 * - null-byte injection
 * - access to OwnPilot's own installation (self-protection)
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { isOwnPilotPath } from '../../security/self-protection.js';

/**
 * Get allowed base directories for file operations (security)
 * For self-hosted single-user setups, workspace and temp dirs are allowed
 * @param workspaceDir Optional workspace directory override from context
 */
function getAllowedPaths(workspaceDir?: string): string[] {
  const paths = [workspaceDir ?? process.env.WORKSPACE_DIR ?? process.cwd(), os.tmpdir()];

  // Only add home dir if explicitly enabled (security consideration)
  if (process.env.ALLOW_HOME_DIR_ACCESS === 'true') {
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (home) paths.push(home);
  }

  return paths.filter(Boolean);
}

/**
 * Get the primary workspace directory
 * @param workspaceDir Optional workspace directory override from context
 */
export function getWorkspaceDir(workspaceDir?: string): string {
  return workspaceDir ?? process.env.WORKSPACE_DIR ?? process.cwd();
}

/**
 * Resolve the real path of `target` when `target` itself does not exist yet
 * (e.g. creating a new file). `fs.realpath` only resolves symlinks for paths
 * that EXIST, so a missing leaf would skip symlink resolution entirely — and
 * `path.normalize` does NOT follow symlinks. That gap lets a symlinked PARENT
 * directory inside the workspace be used to escape it on create/write/delete/
 * move (e.g. writing through a `cache -> /outside` symlink). This walks up to
 * the nearest existing ancestor, resolves ITS symlinks, then re-attaches the
 * non-existent trailing segments so the caller range-checks the real location.
 * Exported for unit testing.
 */
export async function realpathNearestExistingAncestor(target: string): Promise<string> {
  let current = path.resolve(target);
  const trailing: string[] = [];
  for (;;) {
    try {
      const real = await fs.realpath(current);
      return trailing.length ? path.join(real, ...trailing) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        // Reached the filesystem root without an existing ancestor — fall back
        // to the normalized (symlink-free) path.
        return path.normalize(path.resolve(target));
      }
      trailing.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Check if path is within allowed directories (secure implementation)
 * - Resolves symlinks to prevent escape attacks
 * - Uses proper path comparison with separator check
 * @param filePath Path to check
 * @param workspaceDir Optional workspace directory override from context
 */
export async function isPathAllowedAsync(
  filePath: string,
  workspaceDir?: string
): Promise<boolean> {
  try {
    // Resolve relative paths against workspace directory
    const targetPath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(getWorkspaceDir(workspaceDir), filePath);

    // Try to resolve symlinks (if file exists)
    let resolvedPath: string;
    try {
      resolvedPath = await fs.realpath(targetPath);
    } catch {
      // The target doesn't exist yet (e.g. creating a new file). realpath only
      // resolves symlinks for paths that exist and path.normalize does NOT
      // follow symlinks, so resolve the nearest existing ancestor's real path
      // and re-attach the missing remainder — otherwise a symlinked parent
      // directory could be used to escape the workspace on write/create.
      resolvedPath = await realpathNearestExistingAncestor(targetPath);
    }

    // Reject null bytes and other injection attempts
    if (resolvedPath.includes('\0')) {
      return false;
    }

    // Self-protection: NEVER allow access to OwnPilot's own files
    if (isOwnPilotPath(resolvedPath)) {
      return false;
    }

    const allowedPaths = getAllowedPaths(workspaceDir);

    for (const allowed of allowedPaths) {
      const resolvedAllowed = path.resolve(allowed);

      // Normalize separators for cross-platform comparison (Windows backslash → forward slash)
      const normalizedPath = resolvedPath.replace(/\\/g, '/');
      const normalizedAllowed = resolvedAllowed.replace(/\\/g, '/');

      // Check exact match or proper subdirectory (with forward slash separator)
      if (
        normalizedPath === normalizedAllowed ||
        normalizedPath.startsWith(normalizedAllowed + '/')
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a file path, making relative paths relative to workspace
 * @param filePath Path to resolve
 * @param workspaceDir Optional workspace directory override from context
 */
export function resolveFilePath(filePath: string, workspaceDir?: string): string {
  if (path.isAbsolute(filePath)) {
    return path.resolve(filePath);
  }
  return path.resolve(getWorkspaceDir(workspaceDir), filePath);
}
