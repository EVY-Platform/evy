import { RESOURCES_BY_SERVICE } from "evy-types";

/**
 * Keys in `docs/services/service_data.json` for marketplace catalog rows.
 * RPC `resource` values match {@link MARKETPLACE_DATA_RESOURCES} (shared schema).
 */
export const MARKETPLACE_DATA_JSON_KEYS = [
	"selling_reasons",
	"conditions",
	"durations",
	"areas",
	"timeslots",
	"item",
] as const;

/** JSON keys routed to the marketplace database during `bun run db:seed` (see `partitionSeedCatalogData` in `scripts/seed.ts`). */
export const MARKETPLACE_SEED_KEYS = new Set<string>(
	MARKETPLACE_DATA_JSON_KEYS,
);

/** Allowed `resource` values on marketplace Get/Upsert; sourced from the shared RPC schema. */
export const MARKETPLACE_DATA_RESOURCES = new Set(
	RESOURCES_BY_SERVICE.marketplace,
);
