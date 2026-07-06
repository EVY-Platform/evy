import type { IdCandidate } from "./idCandidates";

export const PLACE_SEARCH_API_METHOD = "place_search";

const PLACE_SEARCH_ATTRIBUTE_NAMES = [
	"id",
	"name",
	"address",
	"address.unit",
	"address.street",
	"address.city",
	"address.postcode",
	"address.state",
	"address.country",
	"address.latitude",
	"address.longitude",
] as const;

const API_DATA_SOURCE_ATTRIBUTES: Record<string, readonly string[]> = {
	[PLACE_SEARCH_API_METHOD]: PLACE_SEARCH_ATTRIBUTE_NAMES,
};

function attributeNamesToCandidates(
	attributeNames: readonly string[],
): IdCandidate[] {
	return [...attributeNames]
		.toSorted((a, b) => a.localeCompare(b))
		.map((attributeName) => ({
			id: attributeName,
			name: attributeName,
			category: "Attribute" as const,
			insertMode: "text" as const,
		}));
}

export function getApiDataSourceAttributeCandidates(
	method: string,
): IdCandidate[] {
	const attributeNames = API_DATA_SOURCE_ATTRIBUTES[method];
	if (!attributeNames) {
		return [];
	}
	return attributeNamesToCandidates(attributeNames);
}
