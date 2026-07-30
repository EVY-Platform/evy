import { describe, expect, it } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	assertFlatFlowGraphSubmits,
	assertFlatFlowSubmitsDeclaration,
	collectSubmitTargetsFromFlatFlow,
} from "evy-types/flowSubmits";

const SERVICE = "66b092ae-7cd8-4d67-95b7-30b03568fd90";
const RESOURCE = "dc28ed59-298e-493c-8ff3-3e60f2ebccbd";

function makeFlow(overrides: Partial<DATA_EVY_Flow> = {}): DATA_EVY_Flow {
	return {
		id: "flow-1",
		name: "Flow",
		page_ids: ["page-1"],
		visibility: "public",
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makePage(overrides: Partial<DATA_EVY_Page> = {}): DATA_EVY_Page {
	return {
		id: "page-1",
		name: "Page",
		row_ids: ["row-1"],
		visibility: "public",
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeSubmitRow(id = "row-1"): DATA_EVY_Row {
	return {
		id,
		name: "Submit",
		type: "button",
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
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-01T00:00:00.000Z",
	};
}

describe("flowSubmits flat graph", () => {
	it("collects a single submit target from nested rows", () => {
		const flow = makeFlow();
		const pagesById = {
			"page-1": makePage({
				row_ids: ["sheet-row"],
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

	it("allows a declaration without a submit action", () => {
		const flow = makeFlow({
			submits: { service: SERVICE, resource: RESOURCE },
		});
		const pagesById = { "page-1": makePage({ row_ids: [] }) };
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
