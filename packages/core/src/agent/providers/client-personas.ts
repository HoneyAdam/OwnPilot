/**
 * Client Personas
 *
 * Some "for coding" API plans gate access by `User-Agent` and only accept
 * requests from a whitelist of recognized coding-agent clients. The clearest
 * example is Kimi For Coding (`https://api.kimi.com/coding/v1`), which rejects
 * any non-whitelisted client with:
 *
 *   403 - Kimi For Coding is currently only available for Coding Agents such
 *         as Kimi CLI, Claude Code, Roo Code, Kilo Code, etc.
 *
 * A persona is just a bundle of HTTP headers (today only `User-Agent`) that
 * presents OwnPilot as one of those clients. A provider config references a
 * persona via its `clientPersona` field; `loadProviderConfig` merges the
 * persona's headers into the provider's request headers as the
 * lowest-precedence layer — an inline `headers` entry on the provider still
 * wins, so a provider can override a single header without abandoning the
 * persona.
 *
 * This is the SINGLE place to update when a vendor changes its whitelist or
 * a client bumps the User-Agent string it sends.
 *
 * NOTE: presenting a coding-agent identity to a vendor that gates on it is
 * only appropriate when using your own subscription / API key against an
 * endpoint that is meant to be consumed this way (the vendor documents these
 * integrations under "other coding agents"). It is a deliberate per-provider
 * opt-in via `clientPersona`, never applied by default.
 */

/** Known coding-agent client identities OwnPilot can present as. */
export type ClientPersonaId = 'claude-code' | 'kimi-cli' | 'roo-code' | 'kilo-code' | 'cline';

/**
 * Header bundle per persona. Keep the User-Agent strings current — these are
 * the values the gating vendors match against.
 */
export const CLIENT_PERSONAS: Record<ClientPersonaId, Readonly<Record<string, string>>> = {
  'claude-code': { 'User-Agent': 'claude-cli/1.0.0 (external, cli)' },
  'kimi-cli': { 'User-Agent': 'KimiCLI/0.1.0' },
  'roo-code': { 'User-Agent': 'Roo-Code/3.0.0' },
  'kilo-code': { 'User-Agent': 'Kilo-Code/1.0.0' },
  cline: { 'User-Agent': 'Cline/3.0.0' },
};

/**
 * Resolve the header bundle for a persona id. Returns `undefined` for an
 * absent or unknown id so callers can skip the merge entirely.
 */
export function resolveClientPersonaHeaders(
  personaId: string | undefined
): Record<string, string> | undefined {
  if (!personaId) return undefined;
  const headers = CLIENT_PERSONAS[personaId as ClientPersonaId];
  return headers ? { ...headers } : undefined;
}
