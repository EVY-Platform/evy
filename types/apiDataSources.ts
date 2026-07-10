/**
 * Runtime attribute names for API-backed data sources, derived from the RPC
 * response schemas so the builder stays in sync with the wire contract.
 */

import placeSearchResponseRaw from "./schema/rpc/placeSearch.response.schema.json" with {
	type: "json",
};

function arrayItemPropertyNames(schema: {
	items?: { properties?: Record<string, unknown> };
}): string[] {
	return Object.keys(schema.items?.properties ?? {});
}

export const API_DATA_SOURCE_ATTRIBUTES: Record<string, readonly string[]> = {
	place_search: arrayItemPropertyNames(placeSearchResponseRaw),
};
