/**
 * Usage tracking — gateway-wide singleton.
 *
 * Hosts the `UsageTracker` and `BudgetManager` instances plus their DB
 * persistence wiring. Extracted from `routes/costs.ts` so non-route consumers
 * (chat streaming, middleware) don't have to reach into the routes/ layer for
 * what is essentially a service-layer concern.
 *
 * Routes that own the REST surface (costs.ts, dashboard.ts) import from here,
 * just like services and middleware do.
 */

import { UsageTracker, BudgetManager } from '@ownpilot/core';
import { getLog } from './log.js';

const log = getLog('UsageTracking');

export const usageTracker = new UsageTracker();
export const budgetManager = new BudgetManager(usageTracker);

// Wire DB persistence — fire-and-forget, errors are logged below.
async function wireUsageRepository(): Promise<void> {
  try {
    const { getUsageRepository } = await import('../db/repositories/costs/usage.js');
    const repo = await getUsageRepository();
    usageTracker.setRecordCallback(async (record) => {
      await repo.save(record);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`UsageRepository unavailable, DB persistence disabled: ${msg}`);
  }
}

void wireUsageRepository();
