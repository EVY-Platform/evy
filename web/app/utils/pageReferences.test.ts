import { describe, expect, test } from "bun:test";
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_ActionBranch,
} from "evy-types";
import { findPageReferences } from "./pageReferences";

const FLOW_ID = "flow-1";
const TARGET_PAGE_ID = "page-target";
const OTHER_PAGE_ID = "page-other";
const now = "2026-07-01T00:00:00.000Z";

function navigateTo(pageId: string): UI_ActionBranch {
	return { fn: "navigate", flowId: FLOW_ID, pageId };
}

function row(
	id: string,
	name: string,
	branch: UI_ActionBranch,
	data: Record<string, unknown> = {},
): DATA_EVY_Row {
	return {
		id,
		name,
		type: "Button",
		visible: "true",
		visibility: "public",
		createdAt: now,
		updatedAt: now,
		data: {
			actions: { tap: [{ condition: "", true: branch, false: "" }] },
			...data,
		},
	} as unknown as DATA_EVY_Row;
}

function page(id: string, name: string, rowIds: string[]): DATA_EVY_Page {
	return {
		id,
		name,
		title: name,
		rowIds,
		visibility: "public",
		createdAt: now,
		updatedAt: now,
	} as unknown as DATA_EVY_Page;
}

function fixture() {
	const flow = {
		id: FLOW_ID,
		name: "Flow",
		pageIds: [OTHER_PAGE_ID, TARGET_PAGE_ID],
		visibility: "public",
		createdAt: now,
		updatedAt: now,
	} as unknown as DATA_EVY_Flow;

	const rowsById: Record<string, DATA_EVY_Row> = {
		// On the other page, and the only real reference.
		"row-linking": row(
			"row-linking",
			"Linking row",
			navigateTo(TARGET_PAGE_ID),
		),
		// Nested under a container on the other page.
		"row-nested": row(
			"row-nested",
			"Nested row",
			navigateTo(TARGET_PAGE_ID),
		),
		"row-container": row("row-container", "Container", "", {
			children_row_ids: ["row-nested"],
		}),
		// Belongs to no page at all.
		"row-orphan": row(
			"row-orphan",
			"Orphan row",
			navigateTo(TARGET_PAGE_ID),
		),
		// Navigates somewhere else.
		"row-elsewhere": row(
			"row-elsewhere",
			"Elsewhere row",
			navigateTo(OTHER_PAGE_ID),
		),
	};

	return {
		flowsById: { [FLOW_ID]: flow },
		pagesById: {
			[OTHER_PAGE_ID]: page(OTHER_PAGE_ID, "Other", [
				"row-linking",
				"row-container",
				"row-elsewhere",
			]),
			[TARGET_PAGE_ID]: page(TARGET_PAGE_ID, "Target", []),
		},
		rowsById,
	};
}

describe("findPageReferences", () => {
	test("reports each referencing row once, on the page that holds it", () => {
		const { flowsById, pagesById, rowsById } = fixture();

		// Sorted because walkRows is depth-first over a stack; the guarantee
		// under test is which rows are reported and how many times, not order.
		const references = findPageReferences(
			FLOW_ID,
			TARGET_PAGE_ID,
			flowsById,
			pagesById,
			rowsById,
		).sort((a, b) => a.referenceKey.localeCompare(b.referenceKey));

		// Scanning every row for every page reported these on both pages.
		expect(references).toEqual([
			{
				referenceKey: `${OTHER_PAGE_ID}:row-linking`,
				pageLabel: "Other",
				rowLabel: "Linking row",
			},
			{
				referenceKey: `${OTHER_PAGE_ID}:row-nested`,
				pageLabel: "Other",
				rowLabel: "Nested row",
			},
		]);
	});

	test("ignores a row that belongs to no page", () => {
		const { flowsById, pagesById, rowsById } = fixture();

		const labels = findPageReferences(
			FLOW_ID,
			TARGET_PAGE_ID,
			flowsById,
			pagesById,
			rowsById,
		).map((reference) => reference.rowLabel);

		expect(labels).not.toContain("Orphan row");
	});

	test("finds a reference nested inside a container", () => {
		const { flowsById, pagesById, rowsById } = fixture();

		const labels = findPageReferences(
			FLOW_ID,
			TARGET_PAGE_ID,
			flowsById,
			pagesById,
			rowsById,
		).map((reference) => reference.rowLabel);

		expect(labels).toContain("Nested row");
	});

	test("is empty for an unknown flow", () => {
		const { flowsById, pagesById, rowsById } = fixture();

		expect(
			findPageReferences(
				"missing",
				TARGET_PAGE_ID,
				flowsById,
				pagesById,
				rowsById,
			),
		).toEqual([]);
	});
});
