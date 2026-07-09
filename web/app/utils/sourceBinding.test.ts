import { describe, expect, test } from "bun:test";
import { getApiDataSourceAttributeCandidates } from "./apiDataSources";
import { parseApiSourceMethod } from "./sourceBinding";

describe("sourceBinding", () => {
	test("parseApiSourceMethod resolves API-backed search sources", () => {
		expect(parseApiSourceMethod("{$api:place_search}")).toBe(
			"place_search",
		);
	});
});

describe("apiDataSources", () => {
	test("getApiDataSourceAttributeCandidates returns place search attributes", () => {
		const attributeNames = getApiDataSourceAttributeCandidates(
			"place_search",
		).map((candidate) => candidate.name);

		expect(attributeNames).toContain("id");
		expect(attributeNames).toContain("street");
		expect(attributeNames).toContain("latitude");
		expect(attributeNames).toContain("longitude");
		expect(attributeNames).not.toContain("name");
		expect(attributeNames).not.toContain("address.street");
	});
});
