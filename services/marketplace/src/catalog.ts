/**
 * Resource names served by the marketplace service.
 * This is the single source of truth for:
 * - gRPC ListResources response
 * - seed data partitioning in `scripts/seed.ts`
 *
 * In future, this list could be derived from the database
 * (e.g. `SELECT DISTINCT resource FROM data`), but for now
 * it is explicitly declared here.
 */
export const MARKETPLACE_SERVICE = "marketplace";

export const MARKETPLACE_RESOURCE_NAMES = [
	"selling_reasons",
	"conditions",
	"durations",
	"areas",
	"items",
] as const;

/** JSON keys routed to the marketplace database during `bun run db:seed`. */
export const MARKETPLACE_SEED_KEYS = new Set<string>(
	MARKETPLACE_RESOURCE_NAMES,
);
