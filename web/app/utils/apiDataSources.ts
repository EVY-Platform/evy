import { procedureResultAttributes } from "evy-types/procedures";
import type { IdCandidate } from "./idCandidates";
import { buildAttributeCandidates } from "./idCandidates";

/**
 * Attributes the builder offers for a `{$api:<method>}` source.
 *
 * Empty for an unknown procedure and for one whose response is not a list of
 * rows - `sync` is callable but nothing binds into its envelope.
 */
export function getApiDataSourceAttributeCandidates(
	method: string,
): IdCandidate[] {
	return buildAttributeCandidates(procedureResultAttributes(method));
}
