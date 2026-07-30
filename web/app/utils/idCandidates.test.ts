import { describe, expect, test } from "bun:test";

import type { ServiceResource } from "../types/resources";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	buildResourceAttributeCandidatesForResource,
	buildRowAttributeCandidates,
	createGetAttributeCandidatesForQualifier,
	filterCandidates,
	filterCandidatesForSuggestionContext,
	type IdCandidate,
} from "./idCandidates";
import { parseApiSourceMethod } from "./sourceBinding";

const serviceResources = [
	{ id: "test_service.items", name: "item" },
	{ id: "test_service.selling_reasons", name: "selling reasons" },
] satisfies ServiceResource[];

const serviceNamesById = new Map([["test_service", "Marketplace"]]);

const candidates: IdCandidate[] = [
	{ id: "test_service.items", name: "item", category: "Resource" },
	{
		id: "test_service.item_details",
		name: "item details",
		category: "Resource",
	},
	{
		id: "test_service.selling_reasons",
		name: "selling reasons",
		category: "Resource",
	},
	{ id: "test_service", name: "Marketplace", category: "Service" },
	{ id: "evy.messages", name: "message", category: "Resource" },
];

function makeAttributeCandidate(name: string): IdCandidate {
	return {
		id: name,
		name,
		category: "Attribute",
		insertMode: "text",
	};
}

const attributeCandidate = makeAttributeCandidate("title");

const functionCandidate: IdCandidate = {
	id: "length",
	name: "length()",
	category: "Function",
	insertMode: "text",
};

describe("idCandidates", () => {
	test("buildIdCandidates returns services and resources", () => {
		expect(buildIdCandidates(serviceResources, serviceNamesById)).toEqual([
			{ id: "test_service", name: "Marketplace", category: "Service" },
			{ id: "test_service.items", name: "item", category: "Resource" },
			{
				id: "test_service.selling_reasons",
				name: "selling reasons",
				category: "Resource",
			},
		]);
	});

	test("buildResourceAttributeCandidatesForResource returns only the selected resource attributes", () => {
		const metadata = [
			{
				resourceId: "test_service.items",
				attributeNames: ["title", "price"],
			},
			{
				resourceId: "test_service.other",
				attributeNames: ["name", "status"],
			},
		];

		expect(
			buildResourceAttributeCandidatesForResource(
				metadata,
				"test_service.items",
			),
		).toEqual([
			makeAttributeCandidate("price"),
			makeAttributeCandidate("title"),
		]);
		expect(
			buildResourceAttributeCandidatesForResource(
				metadata,
				"test_service.other",
			),
		).toEqual([
			makeAttributeCandidate("name"),
			makeAttributeCandidate("status"),
		]);
		expect(
			buildResourceAttributeCandidatesForResource(metadata, "missing"),
		).toEqual([]);
	});

	test("buildDatumCandidate returns a text variable candidate", () => {
		expect(buildDatumCandidate()).toEqual({
			id: "$datum",
			name: "$datum",
			category: "Variable",
			insertMode: "text",
		});
	});

	test("buildRowAttributeCandidates derives candidates from SDUI definitions and static root names", () => {
		const candidates = buildRowAttributeCandidates();
		const names = candidates.map((c) => c.name);

		expect(names).toContain("source");
		expect(names).toContain("destination");
		expect(names).toContain("secondary");
		expect(names).toContain("title");
		expect(names).toContain("visible");
		expect(names).toContain("subtitle");
		expect(names).toContain("placeholder");
		expect(names).not.toContain("child_row_id");
		expect(names).not.toContain("children_row_ids");
		expect(names).not.toContain("sheet_row_id");
		expect(names).not.toContain("actions");
		expect(new Set(names).size).toBe(names.length);
		expect(
			candidates.every(
				(c) => c.category === "Attribute" && c.insertMode === "text",
			),
		).toBe(true);
	});

	test("buildFunctionCandidates returns action, expression, and formatting functions", () => {
		const functionNames = buildFunctionCandidates().map(
			(candidate) => candidate.name,
		);

		expect(functionNames).toContain("length()");
		expect(functionNames).toContain("count()");
		expect(functionNames).toContain("sort()");
		expect(functionNames).toContain("filter()");
		expect(functionNames).toContain("owns()");
		expect(functionNames).toContain("navigate()");
		expect(functionNames).toContain("formatDatetime()");
		expect(new Set(functionNames).size).toBe(functionNames.length);
		expect(
			buildFunctionCandidates().every(
				(candidate) =>
					candidate.category === "Function" &&
					candidate.insertMode === "text",
			),
		).toBe(true);
	});

	test("filterCandidates returns candidates for an empty query", () => {
		expect(filterCandidates(candidates, "")).toEqual(candidates);
	});

	test("filterCandidates matches insert value and last dotted segment prefixes", () => {
		expect(
			filterCandidates(candidates, "se").map((candidate) => candidate.id),
		).toEqual(["test_service.selling_reasons"]);
		expect(
			filterCandidates(candidates, "test_service.se").map(
				(candidate) => candidate.id,
			),
		).toEqual(["test_service.selling_reasons"]);
		expect(
			filterCandidates(candidates, "it").map((candidate) => candidate.id),
		).toEqual(["test_service.items", "test_service.item_details"]);
		expect(
			filterCandidates(candidates, "items").map(
				(candidate) => candidate.id,
			),
		).toEqual(["test_service.items"]);
		expect(
			filterCandidates(candidates, "item").map(
				(candidate) => candidate.id,
			),
		).toEqual(["test_service.items", "test_service.item_details"]);
		expect(
			filterCandidates(candidates, "ITEM").map(
				(candidate) => candidate.id,
			),
		).toEqual(["test_service.items", "test_service.item_details"]);
	});

	test("filterCandidates does not match resource friendly names", () => {
		expect(
			filterCandidates(
				[
					{
						id: "test_service.items",
						name: "item",
						category: "Resource",
					},
				],
				"item",
			).map((candidate) => candidate.id),
		).toEqual(["test_service.items"]);
		expect(
			filterCandidates(
				[
					{
						id: "test_service.items",
						name: "item",
						category: "Resource",
					},
				],
				"marketplace",
			),
		).toEqual([]);
	});

	test("filterCandidates returns attributes and functions by insert value", () => {
		const assistCandidates = [attributeCandidate, functionCandidate];
		expect(filterCandidates(assistCandidates, "tit")).toEqual([
			attributeCandidate,
		]);
		expect(filterCandidates(assistCandidates, "len")).toEqual([
			functionCandidate,
		]);
	});

	test("filterCandidatesForSuggestionContext filters root and attribute candidates by context", () => {
		const rootCandidates = [
			...candidates,
			attributeCandidate,
			functionCandidate,
			buildDatumCandidate(),
		];
		const scopedAttributeCandidates = [
			attributeCandidate,
			makeAttributeCandidate("price"),
		];

		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "root",
					query: "it",
				},
			).map((candidate) => candidate.id),
		).toEqual(["test_service.items", "test_service.item_details"]);
		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "root",
					query: "$d",
				},
			),
		).toEqual([buildDatumCandidate()]);
		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "root",
					query: "tit",
				},
			),
		).toEqual([]);
		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "attribute",
					query: "p",
				},
			),
		).toEqual([scopedAttributeCandidates[1]]);
		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "attribute",
					query: "it",
				},
			),
		).toEqual([]);
		expect(
			filterCandidatesForSuggestionContext(
				rootCandidates,
				scopedAttributeCandidates,
				{
					type: "none",
					query: "it",
				},
			),
		).toEqual([]);
	});

	test("filterCandidates dedupes candidates by insert value and category", () => {
		const duplicateAttributeCandidate: IdCandidate = {
			id: "alternate-title",
			name: "title",
			category: "Attribute",
			insertMode: "text",
		};
		const resourceWithMatchingInsertPrefix: IdCandidate = {
			id: "title-resource",
			name: "title",
			category: "Resource",
		};

		expect(
			filterCandidates(
				[
					attributeCandidate,
					duplicateAttributeCandidate,
					resourceWithMatchingInsertPrefix,
				],
				"tit",
			),
		).toEqual([attributeCandidate, resourceWithMatchingInsertPrefix]);
	});
});

describe("api-backed row sources", () => {
	// The production path the builder uses: a row whose source is {$api:...}
	// offers the procedure's result attributes for `$datum`.
	function candidatesForSource(rowSource: string): string[] {
		return createGetAttributeCandidatesForQualifier({
			serviceResources: [],
			resourceAttributeMetadata: [],
			rowSource,
		})("$datum").map((candidate) => candidate.name);
	}

	test("offers a procedure's result attributes", () => {
		const names = candidatesForSource("{$api:place_search}");

		expect(names).toContain("id");
		expect(names).toContain("street");
		expect(names).toContain("latitude");
		expect(names).toContain("longitude");
		expect(names).not.toContain("name");
		expect(names).not.toContain("address.street");
	});

	test("offers nothing for an undeclared procedure", () => {
		expect(candidatesForSource("{$api:unknown_method}")).toEqual([]);
	});

	test("offers nothing for a procedure with no bindable rows", () => {
		// sync is declared, but its response is an envelope.
		expect(candidatesForSource("{$api:sync}")).toEqual([]);
	});

	test("parseApiSourceMethod only matches api sources", () => {
		expect(parseApiSourceMethod("{$api:place_search}")).toBe(
			"place_search",
		);
		expect(parseApiSourceMethod("{items.title}")).toBeNull();
	});
});
