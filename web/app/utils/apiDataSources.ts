import type { IdCandidate } from "./idCandidates";
import { buildAttributeCandidates } from "./idCandidates";

const PLACE_SEARCH_API_METHOD = "place_search";

const PLACE_SEARCH_ATTRIBUTE_NAMES = [
	"id",
	"unit",
	"street",
	"city",
	"postcode",
	"state",
	"country",
	"latitude",
	"longitude",
] as const;

const API_DATA_SOURCE_ATTRIBUTES: Record<string, readonly string[]> = {
	[PLACE_SEARCH_API_METHOD]: PLACE_SEARCH_ATTRIBUTE_NAMES,
};

export function getApiDataSourceAttributeCandidates(
	method: string,
): IdCandidate[] {
	const attributeNames = API_DATA_SOURCE_ATTRIBUTES[method];
	if (!attributeNames) {
		return [];
	}
	return buildAttributeCandidates(attributeNames);
}
