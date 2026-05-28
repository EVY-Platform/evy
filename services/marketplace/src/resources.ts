export const MARKETPLACE_SERVICE = "marketplace";

export const MARKETPLACE_RESOURCE_NAMES = [
	"selling_reasons",
	"conditions",
	"durations",
	"areas",
	"items",
] as const;

export const MARKETPLACE_SEED_RESOURCES = new Set<string>(
	MARKETPLACE_RESOURCE_NAMES,
);
