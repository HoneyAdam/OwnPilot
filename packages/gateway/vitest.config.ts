import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Note: Previously, an alias collapsed @ownpilot/core/* sub-path imports
  // onto the barrel so that vi.mock('@ownpilot/core') would intercept all
  // sub-path imports. This is no longer needed — all test files now use
  // sub-path-specific vi.mock() calls (e.g. vi.mock('@ownpilot/core/services')).
  // Keeping the alias would cause multiple sub-path mocks to collide on the
  // same resolved module. See docs/ADR/vi-mock-sub-path-alignment.md.
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test-setup.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/*.test.ts',
        '**/test-setup.ts',
        '**/test-helpers.ts',
        'dist/**',
        '**/types.ts',
        '**/index.ts',
        '**/*.d.ts',
        '**/vitest.config.ts',
        'scripts/**',
        '**/seed-database.ts',
        '**/plans-seed.ts',
        'src/db/seeds/**',
        'src/services/log.ts',
        'src/app.ts',
        'src/server.ts',
        'src/channels/plugins/telegram/telegram-api.ts',
        'src/middleware/audit.ts',
        // Pure re-export barrel files — no logic to cover
        'src/routes/extensions.ts',
        'src/routes/custom-tools.ts',
        'src/routes/database.ts',
        'src/routes/model-configs.ts',
        'src/routes/workspaces.ts',
      ],
    },
    typecheck: {
      enabled: true,
    },
  },
});
