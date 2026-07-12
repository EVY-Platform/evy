import { describe, expect, test } from "bun:test";
import { parseApiSourceMethod } from "./sourceBinding";

describe("sourceBinding", () => {
	test("parseApiSourceMethod resolves API-backed search sources", () => {
		expect(parseApiSourceMethod("{$api:place_search}")).toBe(
			"place_search",
		);
	});
});
