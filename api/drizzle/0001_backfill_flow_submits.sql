-- Backfills missing Flow.submits declarations for flows with exactly one
-- create(...,submit) target. The data work runs in
-- api/scripts/backfill-flow-submits.ts immediately after this migration.
SELECT 1;
