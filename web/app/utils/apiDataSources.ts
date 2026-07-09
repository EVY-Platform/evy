import { API_DATA_SOURCE_ATTRIBUTES } from "evy-types/apiDataSources";
import type { IdCandidate } from "./idCandidates";
import { buildAttributeCandidates } from "./idCandidates";

export function getApiDataSourceAttributeCandidates(
	method: string,
): IdCandidate[] {
	const attributeNames = API_DATA_SOURCE_ATTRIBUTES[method];
	return attributeNames ? buildAttributeCandidates(attributeNames) : [];
}
