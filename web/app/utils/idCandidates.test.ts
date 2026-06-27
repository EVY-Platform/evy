import { describe, expect, test } from "bun:test";

import type { ServiceResource } from "../api/sync";
import type { UI_Flow } from "../types/flow";
import type { Row } from "../types/row";
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

function makeRow(id: string, content: Partial<Row["config"]>): Row {
	return {
		id,
		row: null,
		config: {
			type: "Text",
			actions: [],
			source: "",
			visible: "true",
			title: "",
			...content,
		},
	};
}

const childRow = makeRow("child-row", {
	title: "Child title",
	subtitle: "Child subtitle",
	text: "Child text",
});

const parentRow = makeRow("parent-row", {
	title: "Parent title",
	placeholder: "Type here",
	child: childRow,
	children: [
		makeRow("nested-row", {
			icon: "::star::",
			title: "Nested title",
		}),
	],
});

const flows = [
	{
		id: "flow-1",
		name: "Checkout",
		pages: [
			{ id: "page-1", title: "Item Details", rows: [parentRow] },
			{ id: "page-2", title: "", rows: [] },
		],
	},
] satisfies UI_Flow[];

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
		expect(buildIdCandidates(flows, serviceResources)).toEqual([
			{ id: "flow-1", name: "Checkout", category: "Flow" },
			{ id: "page-1", name: "Item Details", category: "Page" },
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

	test("buildRowAttributeCandidates returns unique root, content, and nested row attributes", () => {
		expect(buildRowAttributeCandidates(flows)).toEqual(
			[
				"destination",
				"icon",
				"placeholder",
				"source",
				"subtitle",
				"text",
				"title",
				"visible",
			].map(makeAttributeCandidate),
		);
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

	test("filterCandidates only returns starts-with matches", () => {
		expect(
			filterCandidates(candidates, "it").map((candidate) => candidate.id),
		).toEqual(["res-1", "res-1-long"]);
	});

	test("filterCandidates is case-insensitive", () => {
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
});
