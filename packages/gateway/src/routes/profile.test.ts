/**
 * Profile Routes Tests
 *
 * Integration tests for the user profile API endpoints.
 * Mocks getPersonalMemoryStore and getMemoryInjector from core.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { requestId } from '../middleware/request-id.js';
import { errorHandler } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStore = {
  getProfile: vi.fn(async () => ({ name: 'Test User', categories: {} })),
  getProfileSummary: vi.fn(async () => 'User is a developer based in Istanbul.'),
  getCategory: vi.fn(async () => [{ key: 'name', value: 'Test', confidence: 1.0 }]),
  get: vi.fn(async () => null),
  set: vi.fn(async () => ({ key: 'name', value: 'Test', category: 'identity' })),
  delete: vi.fn(async () => true),
  search: vi.fn(async () => [{ key: 'name', value: 'Test', category: 'identity' }]),
  importData: vi.fn(async (entries: unknown[]) => (entries as unknown[]).length),
  exportData: vi.fn(async () => [{ category: 'identity', key: 'name', value: 'Test' }]),
};

const mockInjector = { invalidateCache: vi.fn() };

vi.mock('@ownpilot/core', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    getPersonalMemoryStore: vi.fn(async () => mockStore),
    getMemoryInjector: vi.fn(() => mockInjector),
  };
});

// Import after mocks
const { profileRoutes } = await import('./profile.js');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

function createApp() {
  const app = new Hono();
  app.use('*', requestId);
  app.route('/profile', profileRoutes);
  app.onError(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Profile Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('GET /profile', () => {
    it('returns user profile', async () => {
      const res = await app.request('/profile');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Test User');
    });
  });

  describe('GET /profile/summary', () => {
    it('returns profile summary', async () => {
      const res = await app.request('/profile/summary');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.summary).toContain('developer');
    });
  });

  describe('GET /profile/category/:category', () => {
    it('returns entries for a category', async () => {
      const res = await app.request('/profile/category/identity');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.category).toBe('identity');
      expect(json.data.entries).toHaveLength(1);
    });
  });

  describe('POST /profile/data', () => {
    it('creates a personal data entry', async () => {
      const res = await app.request('/profile/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', key: 'name', value: 'Test' }),
      });

      expect(res.status).toBe(201);
      expect(mockInjector.invalidateCache).toHaveBeenCalled();
    });

    it('returns 400 when required fields missing', async () => {
      const res = await app.request('/profile/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /profile/data', () => {
    it('deletes a personal data entry', async () => {
      const res = await app.request('/profile/data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', key: 'name' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
    });

    it('returns 400 when required fields missing', async () => {
      const res = await app.request('/profile/data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity' }),
      });

      expect(res.status).toBe(400);
    });

    it('also accepts ?category=&key= query params (browser DELETE without body)', async () => {
      const res = await app.request('/profile/data?category=identity&key=name', {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
      expect(mockStore.delete).toHaveBeenCalledWith('identity', 'name');
    });
  });

  describe('GET /profile/search', () => {
    it('searches personal data', async () => {
      const res = await app.request('/profile/search?q=test');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.results).toHaveLength(1);
    });

    it('returns 400 when query missing', async () => {
      const res = await app.request('/profile/search');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /profile/import', () => {
    it('imports personal data', async () => {
      const res = await app.request('/profile/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [{ category: 'identity', key: 'name', value: 'Test' }] }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.imported).toBe(1);
    });

    it('returns 400 when entries is not an array', async () => {
      const res = await app.request('/profile/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: 'invalid' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /profile/export', () => {
    it('exports all personal data', async () => {
      const res = await app.request('/profile/export');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.entries).toHaveLength(1);
      expect(json.data.count).toBe(1);
    });
  });

  describe('GET /profile/inferred', () => {
    it('returns only ai_inferred entries, newest first', async () => {
      mockStore.exportData.mockResolvedValueOnce([
        {
          id: '1',
          category: 'hobbies',
          key: 'reading',
          value: 'sci-fi',
          source: 'user_stated',
          confidence: 1,
          updatedAt: '2026-05-27T10:00:00Z',
        },
        {
          id: '2',
          category: 'food',
          key: 'breakfast',
          value: 'oatmeal',
          source: 'ai_inferred',
          confidence: 0.6,
          updatedAt: '2026-05-27T11:00:00Z',
        },
        {
          id: '3',
          category: 'hobbies',
          key: 'sport',
          value: 'climbing',
          source: 'ai_inferred',
          confidence: 0.8,
          updatedAt: '2026-05-27T12:00:00Z',
        },
      ]);

      const res = await app.request('/profile/inferred');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.count).toBe(2);
      // Newest (id=3) first
      expect(json.data.entries[0].id).toBe('3');
      expect(json.data.entries[1].id).toBe('2');
      // The user_stated one is filtered out
      expect(json.data.entries.find((e: { id: string }) => e.id === '1')).toBeUndefined();
    });

    it('returns an empty list when nothing was inferred', async () => {
      mockStore.exportData.mockResolvedValueOnce([
        {
          id: '1',
          category: 'identity',
          key: 'name',
          value: 'Alice',
          source: 'user_stated',
          confidence: 1,
          updatedAt: '2026-05-27T10:00:00Z',
        },
      ]);

      const res = await app.request('/profile/inferred');
      const json = await res.json();
      expect(json.data.count).toBe(0);
      expect(json.data.entries).toEqual([]);
    });
  });

  describe('POST /profile/inferred/confirm', () => {
    it('promotes an ai_inferred entry to user_confirmed with confidence=1', async () => {
      mockStore.get.mockResolvedValueOnce({
        id: '7',
        category: 'hobbies',
        key: 'sport',
        value: 'climbing',
        source: 'ai_inferred',
        confidence: 0.7,
        sensitive: false,
        data: undefined,
        updatedAt: '2026-05-27T10:00:00Z',
      });
      mockStore.set.mockResolvedValueOnce({
        id: '7',
        category: 'hobbies',
        key: 'sport',
        value: 'climbing',
        source: 'user_confirmed',
        confidence: 1,
        sensitive: false,
        updatedAt: '2026-05-27T11:00:00Z',
      });

      const res = await app.request('/profile/inferred/confirm?category=hobbies&key=sport', {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect(mockStore.set).toHaveBeenCalledWith(
        'hobbies',
        'sport',
        'climbing',
        expect.objectContaining({ source: 'user_confirmed', confidence: 1 })
      );
    });

    it('also accepts a JSON body', async () => {
      mockStore.get.mockResolvedValueOnce({
        id: '8',
        category: 'food',
        key: 'breakfast',
        value: 'oatmeal',
        source: 'ai_inferred',
        confidence: 0.6,
        sensitive: false,
        updatedAt: '2026-05-27T10:00:00Z',
      });
      mockStore.set.mockResolvedValueOnce({});

      const res = await app.request('/profile/inferred/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'food', key: 'breakfast' }),
      });
      expect(res.status).toBe(200);
    });

    it('returns 404 when the entry does not exist', async () => {
      mockStore.get.mockResolvedValueOnce(null);
      const res = await app.request('/profile/inferred/confirm?category=hobbies&key=ghost', {
        method: 'POST',
      });
      expect(res.status).toBe(404);
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('refuses to confirm an entry that is not ai_inferred', async () => {
      mockStore.get.mockResolvedValueOnce({
        id: '9',
        category: 'identity',
        key: 'name',
        value: 'Alice',
        source: 'user_stated',
        confidence: 1,
        sensitive: false,
        updatedAt: '2026-05-27T10:00:00Z',
      });
      const res = await app.request('/profile/inferred/confirm?category=identity&key=name', {
        method: 'POST',
      });
      expect(res.status).toBe(400);
      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });

  describe('POST /profile/quick', () => {
    it('sets multiple profile fields at once', async () => {
      const res = await app.request('/profile/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test', location: 'Istanbul', timezone: 'Europe/Istanbul' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.updated).toBe(3);
    });
  });

  describe('GET /profile/categories', () => {
    it('returns available categories', async () => {
      const res = await app.request('/profile/categories');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.identity).toBeDefined();
      expect(json.data.location).toBeDefined();
      expect(json.data.communication).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Error path coverage — all service methods throw
// ---------------------------------------------------------------------------

describe('Profile Routes — error paths', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.getProfile.mockResolvedValue({ name: 'Test User', categories: {} });
    app = createApp();
  });

  it('GET /profile returns 500 when getProfile throws', async () => {
    mockStore.getProfile.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile');
    expect(res.status).toBe(500);
  });

  it('GET /profile/summary returns 500 when getProfileSummary throws', async () => {
    mockStore.getProfileSummary.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/summary');
    expect(res.status).toBe(500);
  });

  it('GET /profile/category/:cat returns 500 when getCategory throws', async () => {
    mockStore.getCategory.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/category/identity');
    expect(res.status).toBe(500);
  });

  it('POST /profile/data returns 500 when set throws', async () => {
    mockStore.set.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'identity', key: 'name', value: 'Test' }),
    });
    expect(res.status).toBe(500);
  });

  it('DELETE /profile/data returns 500 when delete throws', async () => {
    mockStore.delete.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/data', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'identity', key: 'name' }),
    });
    expect(res.status).toBe(500);
  });

  it('GET /profile/search returns 500 when search throws', async () => {
    mockStore.search.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/search?q=test');
    expect(res.status).toBe(500);
  });

  it('POST /profile/import returns 500 when importData throws', async () => {
    mockStore.importData.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [{ category: 'identity', key: 'name', value: 'Test' }] }),
    });
    expect(res.status).toBe(500);
  });

  it('GET /profile/export returns 500 when exportData throws', async () => {
    mockStore.exportData.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/export');
    expect(res.status).toBe(500);
  });

  it('POST /profile/quick returns 500 when set throws', async () => {
    mockStore.set.mockRejectedValueOnce(new Error('DB error'));
    const res = await app.request('/profile/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(500);
  });
});
