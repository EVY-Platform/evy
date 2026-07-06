import { describe, expect, test } from "bun:test";
import {
	getApiDataSourceAttributeCandidates,
	PLACE_SEARCH_API_METHOD,
} from "./apiDataSources";
import { parseSourceBinding } from "./sourceBinding";

describe("sourceBinding", () => {
	test("parseSourceBinding resolves API-backed search sources", () => {
		expect(parseSourceBinding("{$api:place_search}")).toEqual({
			kind: "api",
			method: PLACE_SEARCH_API_METHOD,
		});
	});
});

describe("apiDataSources", () => {
	test("getApiDataSourceAttributeCandidates returns place search attributes", () => {
		const attributeNames = getApiDataSourceAttributeCandidates(
			PLACE_SEARCH_API_METHOD,
		).map((candidate) => candidate.name);

		expect(attributeNames).toContain("id");
		expect(attributeNames).toContain("name");
		expect(attributeNames).toContain("address.street");
		expect(attributeNames).toContain("address.latitude");
	});
});
