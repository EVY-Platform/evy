import { describe, expect, it } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	assertFlatFlowGraphSubmits,
	assertFlatFlowSubmitsDeclaration,
	collectSubmitTargetsFromFlatFlow,
	resolveSubmitsForFlatFlow,
} from "evy-types/flowSubmits";

const SERVICE = "66b092ae-7cd8-4d67-95b7-30b03568fd90";
const RESOURCE = "dc28ed59-298e-493c-8ff3-3e60f2ebccbd";

function makeFlow(overrides: Partial<DATA_EVY_Flow> = {}): DATA_EVY_Flow {
	return {
		id: "flow-1",
		name: "Flow",
		pageIds: ["page-1"],
		visibility: "public",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makePage(overrides: Partial<DATA_EVY_Page> = {}): DATA_EVY_Page {
	return {
		id: "page-1",
		name: "Page",
		rowIds: ["row-1"],
		visibility: "public",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeSubmitRow(id = "row-1"): DATA_EVY_Row {
	return {
		id,
		name: "Submit",
		type: "Button",
		visible: "true",
		data: {
			actions: {
				tap: [
					{
						condition: "",
						false: "",
						true: {
							fn: "create",
							service: SERVICE,
							resource: RESOURCE,
							mode: "submit",
						},
					},
				],
			},
		},
		visibility: "public",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};
}

describe("flowSubmits flat graph", () => {
	it("collects a single submit target from nested rows", () => {
		const flow = makeFlow();
		const pagesById = {
			"page-1": makePage({
				rowIds: ["sheet-row"],
			}),
		};
		const rowsById = {
			"sheet-row": {
				...makeSubmitRow("sheet-row"),
				data: {
					sheet_row_id: "submit-row",
				},
			},
			"submit-row": makeSubmitRow("submit-row"),
		};

		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);

		expect([...targets]).toEqual([`${SERVICE}/${RESOURCE}`]);
	});

	it("backfills a missing declaration when there is one submit target", () => {
		const flow = makeFlow();
		const pagesById = { "page-1": makePage() };
		const rowsById = { "row-1": makeSubmitRow() };
		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);

		expect(resolveSubmitsForFlatFlow(flow, targets)).toEqual({
			service: SERVICE,
			resource: RESOURCE,
		});
	});

	it("rejects multiple undeclared submit targets", () => {
		const flow = makeFlow();
		const pagesById = {
			"page-1": makePage({ rowIds: ["row-a", "row-b"] }),
		};
		const rowsById = {
			"row-a": makeSubmitRow("row-a"),
			"row-b": {
				...makeSubmitRow("row-b"),
				data: {
					actions: {
						tap: [
							{
								condition: "",
								false: "",
								true: {
									fn: "create",
									service: SERVICE,
									resource: "other-resource",
									mode: "submit",
								},
							},
						],
					},
				},
			},
		};
		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);

		expect(() => resolveSubmitsForFlatFlow(flow, targets)).toThrow(
			"submits multiple resources",
		);
	});

	it("rejects a declaration that disagrees with the action", () => {
		const flow = makeFlow({
			submits: { service: SERVICE, resource: "declared-resource" },
		});
		const pagesById = { "page-1": makePage() };
		const rowsById = { "row-1": makeSubmitRow() };
		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);

		expect(() => resolveSubmitsForFlatFlow(flow, targets)).toThrow(
			"declares submits",
		);
	});

	it("allows a declaration without a submit action", () => {
		const flow = makeFlow({
			submits: { service: SERVICE, resource: RESOURCE },
		});
		const pagesById = { "page-1": makePage({ rowIds: [] }) };
		const rowsById = {};

		expect(() =>
			assertFlatFlowGraphSubmits([flow], pagesById, rowsById),
		).not.toThrow();
	});

	it("requires a declaration when a submit action exists", () => {
		const flow = makeFlow();
		const pagesById = { "page-1": makePage() };
		const rowsById = { "row-1": makeSubmitRow() };
		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);

		expect(() => assertFlatFlowSubmitsDeclaration(flow, targets)).toThrow(
			'declares no "submits"',
		);
	});
});
