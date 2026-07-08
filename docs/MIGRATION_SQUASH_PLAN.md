# Migration Squash Plan

**Date:** 2026-07-08
**Context:** Codebase audit finding — 41 SQL migrations is high. 3 are "drop" migrations that revert earlier schema decisions.

## Current State

`packages/gateway/src/db/migrations/postgres/` contains **41 sequential migration files**.

### Schema Evolution Timeline

```
Phase 1 — Initial Build (001–010)
  001  initial_schema           Core tables (agents, conversations, messages, etc.)
  002  background_agents        Initial background agent system
  003  background_agents_v2     Redesign: added scheduling, status, output format
  004  subagents                Subagent delegation system
  005  ucp                      Unified Communication Protocol
  006  orchestra                Orchestration engine
  007  artifacts                Artifact storage
  008  browser                  Browser automation
  009  skills_platform          Skill marketplace
  010  edge_delegation          IoT/edge device delegation

Phase 2 — Agent Souls (011–019)
  011  agent_souls              Agent personality/identity system
  012  soul_provider            Souls with provider bindings
  013  background_agents_skills  Skills for background agents
  014  memories_content_hash     Content hash for dedup
  015  owner_pairing            Owner-pairing relationship
  016  orchestration_enable_analysis  Analysis toggle
  017  autonomy_log_signal_ids  Signal tracking for autonomy
  018  fleet                    Fleet management
  019  claw_crew_enhancements   Claw + crew improvements

Phase 3 — Claw Era + Cleanup (020–029)
  020  ✂️ drop_dead_tables       First schema cleanup
  021  expenses_table           New feature: expense tracking
  022  claws                    Claw system (replaces background agents)
  023  claw_fixes               Fixes to claw schema
  024  provider_billing         Billing/usage tracking
  025  ✂️ drop_background_agents  Drop tables replaced by claws
  026  subagent_parent_type      Schema fix
  027  performance_indexes       Performance indexes (round 1)
  028  ui_sessions              UI session management
  029  claw_advanced_config     Extended claw configuration

Phase 4 — Production Hardening (030–041)
  030  idempotency_keys         Idempotency for job safety
  031  job_queue                Job queue system
  032  retention_policies       Data retention policies
  033  usage_records            Usage tracking records
  034  claw_session_state_index  Claw performance index
  035  ✂️ user_extension_removals  Cleanup unused extension columns
  036  fleet_last_cycle_at      Fleet schema addition
  037  perf_indexes             Performance indexes (round 2)
  038  ✂️ drop_legacy_agent_systems  Final legacy cleanup
  039  conversation_fts         Full-text search for conversations
  040  dm_pairing               Direct message pairing
  041  canvas_elements          Live canvas elements
```

## Issues Identified

1. **3 drop migrations** (020, 025, 038) — architectural churn. The background_agents → claws migration took 3 iterations (002→003→013→025 drop).
2. **2 perf index migrations** (027, 037) — first round of indexes missed some tables.
3. **Interleaved schema + cleanup** — new features (021 expenses, 022 claws) appear between drop migrations, making squash non-trivial.
4. **Subagent/Fleet tables** created in 004/018 but never explicitly dropped — may still exist in some databases.

## Squash Strategy

### Recommended: 4-Phase Squash

Consolidate into **4 well-named migration files**, keeping the logical evolution visible:

| New File                        | Old Files | Rationale                                                      |
| ------------------------------- | --------- | -------------------------------------------------------------- |
| `001_initial_schema.sql`        | 001–010   | All initial tables, no cleanup yet                             |
| `011_agent_souls_and_crews.sql` | 011–019   | Agent soul system + crew expansion                             |
| `020_claw_migration.sql`        | 020–029   | Claw replacement of background agents + expenses + UI sessions |
| `030_production_hardening.sql`  | 030–041   | Final state with all performance indexes                       |

**Result:** 41 files → 4 files (90% reduction).

### Execution Steps

1. **Create new files** by concatenating DDL from each group in order, removing `DROP TABLE IF EXISTS` statements for tables that are recreated later in the sequence.
2. **Wrap in idempotent checks** — each file should use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so re-runs are safe.
3. **Update `migration-smoke-test.ts`** — the critical tables list should reflect the final state (not intermediate tables that were later dropped).
4. **Verify against a clean database** — run `pnpm migration:smoke` on a fresh PostgreSQL to confirm the squashed schema produces the same final state.

### Risk Assessment

| Risk                                                                 | Mitigation                                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Production DB at migration 41 would need to re-run from squashed 001 | Use `PRAGMA user_version` or equivalent to track applied schema version; only apply squashed files on fresh deploys |
| Squash might miss a subtle column rename                             | Generate the schema from migration 41 final state with `pg_dump --schema-only`, then diff against squashed output   |
| Foreign key ordering broken                                          | Test on a clean DB with the smoke test suite before deploying                                                       |

## Recommendation

Squash during the **next major version bump** (e.g., 0.9.0 or 1.0.0) when a fresh database deploy is expected. For existing production databases at migration 41, leave them as-is — the squashed files are only for new deployments.

---

_Part of codebase audit: `docs/CODEBASE_AUDIT_2026-07-08.md`_
