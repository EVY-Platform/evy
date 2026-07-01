import { describe, expect, test } from "bun:test";

import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";
import type { ServiceResource } from "../api/sync";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	buildResourceAttributeCandidatesForResource,
	buildRowAttributeCandidates,
	filterCandidates,
	filterCandidatesForSuggestionContext,
	getIdDisplayParts,
	type IdCandidate,
} from "./idCandidates";

const flowsById: Record<string, DATA_EVY_Flow> = {
	"flow-1": {
		id: "flow-1",
		name: "Checkout",
		pageIds: ["page-1", "page-2"],
		createdAt: "",
		updatedAt: "",
	},
};

const pagesById: Record<string, DATA_EVY_Page> = {
	"page-1": {
		id: "page-1",
		name: "page-1",
		title: "Item Details",
		rowIds: ["parent-row"],
		createdAt: "",
		updatedAt: "",
	},
	"page-2": {
		id: "page-2",
		name: "page-2",
		title: "",
		rowIds: [],
		createdAt: "",
		updatedAt: "",
	},
};

const serviceResources = [
	{ id: "res-1", fkServiceId: "service-1", name: "item" },
] satisfies ServiceResource[];

const candidates: IdCandidate[] = [
	{ id: "res-1", name: "item", category: "Resource" },
	{ id: "res-1-long", name: "item details", category: "Resource" },
	{ id: "service-1", name: "Marketplace", category: "Service" },
	{ id: "flow-1", name: "Edit item", category: "Flow" },
	{ id: "page-1", name: "Checkout", category: "Page" },
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
	test("buildIdCandidates returns flows, pages, and resources", () => {
		expect(
			buildIdCandidates(flowsById, pagesById, serviceResources),
		).toEqual([
			{ id: "flow-1", name: "Checkout", category: "Flow" },
			{ id: "page-1", name: "page-1", category: "Page" },
			{ id: "page-2", name: "page-2", category: "Page" },
			{ id: "service-1", name: "service-1", category: "Service" },
			{ id: "res-1", name: "item", category: "Resource" },
		]);
	});

	test("buildResourceAttributeCandidatesForResource returns only the selected resource attributes", () => {
		const metadata = [
			{
				serviceId: "service-1",
				resourceId: "res-1",
				attributeNames: ["title", "price"],
			},
			{
				serviceId: "service-1",
				resourceId: "res-2",
				attributeNames: ["name", "status"],
			},
		];

		expect(
			buildResourceAttributeCandidatesForResource(metadata, "res-1"),
		).toEqual([
			makeAttributeCandidate("price"),
			makeAttributeCandidate("title"),
		]);
		expect(
			buildResourceAttributeCandidatesForResource(metadata, "res-2"),
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
		expect(names).not.toContain("childRowId");
		expect(names).not.toContain("childrenRowIds");
		expect(names).not.toContain("actions");
		expect(new Set(names).size).toBe(names.length);
		expect(
			candidates.every(
				(c) => c.category === "Attribute" && c.insertMode === "text",
			),
		).toBe(true);
	});

	test("buildFunctionCandidates returns action, expression, formatting, and builder functions", () => {
		const functionNames = buildFunctionCandidates().map(
			(candidate) => candidate.name,
		);

		expect(functionNames).toContain("length()");
		expect(functionNames).toContain("count()");
		expect(functionNames).toContain("navigate()");
		expect(functionNames).toContain("buildCurrency()");
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

	test("filterCandidates only returns case-insensitive starts-with matches", () => {
		expect(
			filterCandidates(candidates, "it").map((candidate) => candidate.id),
		).toEqual(["res-1", "res-1-long"]);
		expect(
			filterCandidates(candidates, "ITEM").map(
				(candidate) => candidate.id,
			),
		).toEqual(["res-1", "res-1-long"]);
	});

	test("filterCandidates returns attributes and functions by name", () => {
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
		).toEqual(["res-1", "res-1-long"]);
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

	test("filterCandidates dedupes candidates by name and category", () => {
		const duplicateAttributeCandidate: IdCandidate = {
			id: "alternate-title",
			name: "title",
			category: "Attribute",
			insertMode: "text",
		};
		const resourceWithMatchingName: IdCandidate = {
			id: "title-resource",
			name: "title",
			category: "Resource",
		};

		expect(
			filterCandidates(
				[
					attributeCandidate,
					duplicateAttributeCandidate,
					resourceWithMatchingName,
				],
				"tit",
			),
		).toEqual([attributeCandidate, resourceWithMatchingName]);
	});

	test("getIdDisplayParts returns text, candidate, and attribute parts for an embedded resource with attribute", () => {
		expect(getIdDisplayParts("{res-1.title} hello", candidates)).toEqual([
			{ type: "text", text: "{", start: 0, end: 1 },
			{
				type: "candidate",
				rawId: "res-1",
				displayName: "item",
				start: 1,
				end: 6,
			},
			{ type: "text", text: ".", start: 6, end: 7 },
			{ type: "attribute", text: "title", start: 7, end: 12 },
			{ type: "text", text: "} hello", start: 12, end: 19 },
		]);
	});

	test("getIdDisplayParts highlights each attribute segment without separators", () => {
		expect(getIdDisplayParts("{res-1.title.name}", candidates)).toEqual([
			{ type: "text", text: "{", start: 0, end: 1 },
			{
				type: "candidate",
				rawId: "res-1",
				displayName: "item",
				start: 1,
				end: 6,
			},
			{ type: "text", text: ".", start: 6, end: 7 },
			{ type: "attribute", text: "title", start: 7, end: 12 },
			{ type: "text", text: ".", start: 12, end: 13 },
			{ type: "attribute", text: "name", start: 13, end: 17 },
			{ type: "text", text: "}", start: 17, end: 18 },
		]);
	});

	test("getIdDisplayParts does not emit an attribute part for a lone dot with no name", () => {
		const parts = getIdDisplayParts("{res-1.}", candidates);
		const hasAttributePart = parts.some((p) => p.type === "attribute");
		expect(hasAttributePart).toBe(false);
	});

	test("getIdDisplayParts does not resolve attribute or function text candidates", () => {
		expect(getIdDisplayParts("title", [attributeCandidate])).toEqual([
			{ type: "text", text: "title", start: 0, end: 5 },
		]);
		expect(getIdDisplayParts("length()", [functionCandidate])).toEqual([
			{ type: "text", text: "length()", start: 0, end: 8 },
		]);
	});

	test("getIdDisplayParts resolves flow and page ids as named candidate chips", () => {
		expect(
			getIdDisplayParts("navigate(flow-1, page-1)", candidates),
		).toEqual([
			{ type: "text", text: "navigate(", start: 0, end: 9 },
			{
				type: "candidate",
				rawId: "flow-1",
				displayName: "Edit item",
				start: 9,
				end: 15,
			},
			{ type: "text", text: ", ", start: 15, end: 17 },
			{
				type: "candidate",
				rawId: "page-1",
				displayName: "Checkout",
				start: 17,
				end: 23,
			},
			{ type: "text", text: ")", start: 23, end: 24 },
		]);
	});
});
