/**
 * Profile API Endpoints
 */

import { apiClient } from '../client';
import type { ProfileData } from '../types';

export interface InferredProfileEntry {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: 'user_stated' | 'user_confirmed' | 'ai_inferred' | 'imported';
  sensitive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const profileApi = {
  get: () => apiClient.get<ProfileData>('/profile'),
  quickSetup: (data: Record<string, unknown>) =>
    apiClient.post<{ profile: ProfileData }>('/profile/quick', data),
  setData: (category: string, key: string, value: unknown) =>
    apiClient.post<void>('/profile/data', { category, key, value }),
  /** Delete a single profile entry by category + key. */
  deleteData: (category: string, key: string) =>
    apiClient.delete<{ deleted: boolean }>(
      `/profile/data?category=${encodeURIComponent(category)}&key=${encodeURIComponent(key)}`
    ),
  /** List entries the profile-learning loop wrote (source='ai_inferred'). */
  listInferred: () =>
    apiClient.get<{ entries: InferredProfileEntry[]; count: number }>('/profile/inferred'),
  /**
   * Promote an inferred entry to user_confirmed so subsequent learning
   * passes treat it as canonical. The gateway 404s when the entry isn't
   * present and 400s when it isn't currently ai_inferred.
   */
  confirmInferred: (category: string, key: string) =>
    apiClient.post<InferredProfileEntry>(
      `/profile/inferred/confirm?category=${encodeURIComponent(category)}&key=${encodeURIComponent(key)}`
    ),
  export: () => apiClient.get<{ entries: Array<Record<string, unknown>> }>('/profile/export'),
  import: (entries: Array<Record<string, unknown>>) =>
    apiClient.post<void>('/profile/import', { entries }),
};
