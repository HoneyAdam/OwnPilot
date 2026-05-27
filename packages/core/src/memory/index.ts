/**
 * Secure Personal Memory System
 *
 * Privacy & Security First Design:
 * - All data encrypted at rest (AES-256-GCM)
 * - Per-user isolated memory spaces
 * - Access control with permissions
 * - Comprehensive audit logging
 * - Secure key derivation (never stored)
 * - Data expiration and secure deletion
 * - Memory types: facts, preferences, conversations, semantic
 */

// =============================================================================
// Re-export Types
// =============================================================================

export type {
  MemoryType,
  AccessLevel,
  MemoryMetadata,
  EncryptedMemoryEntry,
  MemoryEntry,
  MemoryQuery,
  AuditLogEntry,
  SecureMemoryConfig,
} from './types.js';

// =============================================================================
// Re-export Secure Memory Store
// =============================================================================

export { SecureMemoryStore } from './secure-store.js';

// =============================================================================
// Factory Functions
// =============================================================================

import type { SecureMemoryConfig } from './types.js';
import { SecureMemoryStore } from './secure-store.js';

/**
 * Create a new secure memory store
 */
export function createSecureMemoryStore(config?: SecureMemoryConfig): SecureMemoryStore {
  return new SecureMemoryStore(config);
}

/**
 * Memory store singleton (for convenience)
 */
let defaultStore: SecureMemoryStore | null = null;

export async function getDefaultMemoryStore(): Promise<SecureMemoryStore> {
  if (!defaultStore) {
    defaultStore = createSecureMemoryStore();
    await defaultStore.initialize();
  }
  return defaultStore;
}

// =============================================================================
// Re-export Conversation Memory
// =============================================================================

export {
  // Types
  type MemoryCategory,
  type MemoryImportance,
  type MemorySource,
  type MemoryEntry as ConversationMemoryEntry,
  type ConversationSummary,
  type UserProfile,
  type MemoryQueryOptions,
  type MemoryStats as ConversationMemoryStats,
  type MemoryRetentionPolicy,
  // Classes
  ConversationMemoryStore,
  // Factory functions
  createConversationMemoryStore,
  getMemoryStore,
  // Constants
  DEFAULT_RETENTION_POLICY,
} from './conversation.js';

// =============================================================================
// Re-export Personal Memory
// =============================================================================

export {
  // Types
  type PersonalDataCategory,
  type PersonalDataEntry,
  type ComprehensiveProfile,
  // Classes
  PersonalMemoryStore,
  // Factory functions
  createPersonalMemoryStore,
  getPersonalMemoryStore,
} from './personal.js';

// =============================================================================
// Re-export Profile Learning (dialectic user-modeling loop)
// =============================================================================

export {
  type ExtractedFact,
  type ProfileLearnResult,
  type CompleteFn,
  INFERABLE_CATEGORIES,
  MAX_FACTS_PER_PASS,
  buildProfileExtractionPrompt,
  parseExtractedFacts,
  applyExtractedFacts,
  learnProfileFromText,
} from './profile-learning.js';

// =============================================================================
// Re-export Memory Distillation (memory engine: extract / consolidate / recall)
// =============================================================================

export {
  type MemoryCandidate,
  type ExtractableMemoryType,
  EXTRACTABLE_MEMORY_TYPES,
  MAX_MEMORIES_PER_PASS,
  MAX_MEMORY_CONTENT_CHARS,
  buildMemoryExtractionPrompt,
  parseMemoryCandidates,
  buildConsolidationPrompt,
  parseConsolidation,
  buildRecallSummaryPrompt,
  cosineSimilarity,
} from './memory-distillation.js';
