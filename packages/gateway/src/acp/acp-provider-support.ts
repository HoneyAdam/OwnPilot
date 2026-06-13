/**
 * ACP Provider Support
 *
 * Determines which coding agent providers support the ACP protocol
 * and builds the appropriate CLI arguments for ACP mode.
 *
 * Three modes of ACP support:
 * - Native:  Provider has built-in ACP (gemini-cli --experimental-acp)
 * - Bridge:  Community ACP adapter invoked via npx (acp-claude-code, codex-acp)
 * - None:    Provider doesn't support ACP yet
 */

import type { BuiltinCodingAgentProvider, CodingAgentProvider } from '@ownpilot/core/agent';
import { isBuiltinProvider } from '@ownpilot/core/agent';

// =============================================================================
// ACP SUPPORT DETECTION
// =============================================================================

type AcpMode = 'native' | 'bridge';

interface AcpProviderConfig {
  mode: AcpMode;
  /** For bridge mode: the npx package to invoke */
  bridgePackage?: string;
  /** CLI args to enable ACP */
  buildArgs: (options?: { model?: string; cwd?: string }) => string[];
}

/** ACP configuration per built-in provider */
const ACP_PROVIDER_CONFIGS: Partial<Record<BuiltinCodingAgentProvider, AcpProviderConfig>> = {
  'gemini-cli': {
    mode: 'native',
    buildArgs: (options) => [
      '--experimental-acp',
      ...(options?.model ? ['--model', options.model] : []),
    ],
  },
  'claude-code': {
    mode: 'bridge',
    bridgePackage: 'acp-claude-code',
    buildArgs: (options) => [
      'acp-claude-code',
      ...(options?.model ? ['--model', options.model] : []),
    ],
  },
  codex: {
    mode: 'bridge',
    bridgePackage: 'codex-acp',
    buildArgs: (options) => ['codex-acp', ...(options?.model ? ['--model', options.model] : [])],
  },
};

/**
 * Check if a provider supports ACP protocol communication.
 */
export function isAcpSupported(provider: CodingAgentProvider): boolean {
  if (isBuiltinProvider(provider)) {
    return provider in ACP_PROVIDER_CONFIGS;
  }
  return false;
}

/**
 * Get the ACP mode for a provider ('native' | 'bridge' | null).
 */
export function getAcpMode(provider: CodingAgentProvider): AcpMode | null {
  if (!isBuiltinProvider(provider)) return null;
  return ACP_PROVIDER_CONFIGS[provider]?.mode ?? null;
}

/**
 * Build CLI arguments for launching a provider in ACP mode.
 * Returns null if the provider doesn't support ACP.
 */
export function buildAcpArgs(
  provider: CodingAgentProvider,
  options?: {
    model?: string;
    cwd?: string;
  }
): string[] | null {
  if (!isBuiltinProvider(provider)) return null;
  const config = ACP_PROVIDER_CONFIGS[provider];
  if (!config) return null;
  return config.buildArgs(options);
}

/**
 * Get the binary to use for ACP mode.
 *
 * - Native mode: returns the provider's own CLI binary (gemini, claude, codex)
 * - Bridge mode: returns 'npx' since the bridge adapter is invoked via npx
 */
export function getAcpBinary(provider: BuiltinCodingAgentProvider): string {
  const config = ACP_PROVIDER_CONFIGS[provider];
  if (config?.mode === 'bridge') {
    return 'npx';
  }
  // Native mode or fallback: use the provider's own binary
  const binaries: Record<BuiltinCodingAgentProvider, string> = {
    'claude-code': 'claude',
    codex: 'codex',
    'gemini-cli': 'gemini',
  };
  return binaries[provider];
}

/**
 * Get the bridge package name for a provider (if using bridge mode).
 */
export function getAcpBridgePackage(provider: CodingAgentProvider): string | null {
  if (!isBuiltinProvider(provider)) return null;
  return ACP_PROVIDER_CONFIGS[provider]?.bridgePackage ?? null;
}
