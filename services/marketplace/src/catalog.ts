import pluralize from "pluralize";

/**
 * Keys in `docs/services/service_data.json` for marketplace catalog rows.
 * RPC `resource` values are the pluralized form — see {@link MARKETPLACE_DATA_RESOURCES}.
 */
export const MARKETPLACE_DATA_JSON_KEYS = [
	"selling_reasons",
	"conditions",
	"durations",
	"areas",
	"timeslots",
	"item",
] as const;

/** JSON keys accepted by {@link extractMarketplaceData} in seed script. */
export const MARKETPLACE_SEED_KEYS = new Set<string>(MARKETPLACE_DATA_JSON_KEYS);

/** Allowed `resource` values on marketplace Get/Upsert (RPC uses plural names). */
export const MARKETPLACE_DATA_RESOURCES = new Set(
	MARKETPLACE_DATA_JSON_KEYS.map((key) => pluralize.plural(key)),
);
