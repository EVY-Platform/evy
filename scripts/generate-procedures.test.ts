import { describe, expect, it } from "bun:test";
import {
	generateTypeScript,
	resultAttributes,
	validateSchema,
} from "./generate-procedures";

const VALID = {
	procedures: {
		place_search: {
			service: "svc-1",
			response: "rpc/placeSearch.response.schema.json",
		},
	},
};

describe("procedures manifest validation", () => {
	it("accepts a well-formed manifest", () => {
		expect(() => validateSchema(structuredClone(VALID))).not.toThrow();
	});

	it("rejects an empty registry", () => {
		expect(() => validateSchema({ procedures: {} })).toThrow(
			"must not be empty",
		);
	});

	it("requires each procedure to name its owning service", () => {
		const manifest = structuredClone(VALID) as Record<string, never>;
		// biome-ignore lint/performance/noDelete: exercising a missing field
		delete (manifest.procedures as Record<string, Record<string, unknown>>)
			.place_search.service;
		expect(() => validateSchema(manifest)).toThrow(
			"procedures.place_search.service must be a non-empty string",
		);
	});

});

describe("result attributes", () => {
	it("reads the item properties of an array response", () => {
		expect(
			resultAttributes({
				type: "array",
				items: { properties: { id: {}, street: {} } },
			}),
		).toEqual(["id", "street"]);
	});

	it("is empty for a response that is not a list of rows", () => {
		// `sync` returns an envelope; nothing in the builder binds into it.
		expect(
			resultAttributes({ type: "object", properties: { cursor: {} } }),
		).toEqual([]);
	});
});

describe("generated registry", () => {
	it("emits metadata for each procedure", async () => {
		const output = await generateTypeScript(
			{
				procedures: {
					sync: {
						service: "svc-1",
						response: "b.json",
					},
					place_search: VALID.procedures.place_search,
				},
			},
			async (path) =>
				path.endsWith("b.json")
					? { type: "object" }
					: { type: "array", items: { properties: { id: {} } } },
		);

		expect(output).toContain('"sync"');
		expect(output).toContain('"place_search"');
		expect(output).toContain('resultAttributes: ["id"]');
	});
});
