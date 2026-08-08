import { describe, expect, it } from "bun:test";
import type { Row } from "../types/row";
import { rowToFlatRecords } from "./rowCodec";
import { buildRowConfigFromRecord } from "./rowConfig";

const NOW = "2024-01-01T00:00:00.000Z";

function makeUiRow(id: string, config: Record<string, unknown>): Row {
	return {
		id,
		row: null,
		config: {
			type: "search",
			actions: {},
			visible: "true",
			title: "search",
			source: "",
			destination: "",
			...config,
		} as Row["config"],
	};
}

describe("rowCodec", () => {
	it("serializes empty actions in row data", () => {
		const row = makeUiRow("row-actions", { type: "search", actions: {} });
		const records = rowToFlatRecords(row, NOW);
		const record = records.find((r) => r.id === "row-actions");
		expect(record?.data.actions).toEqual({});

		const rebuilt = buildRowConfigFromRecord(
			record as NonNullable<typeof record>,
		);
		expect(rebuilt.actions).toEqual({});
	});

	it("round-trips Search child and sheet independently", () => {
		const search = makeUiRow("search-1", {
			type: "search",
			child_row_id: "child-1",
			sheet_row_id: "sheet-1",
		});
		const records = rowToFlatRecords(search, NOW);
		const searchRecord = records.find((r) => r.id === "search-1");
		expect(searchRecord?.data.child_row_id).toBe("child-1");
		expect(searchRecord?.data.sheet_row_id).toBe("sheet-1");
	});

	it("decomposes nested child and sheet rows into separate records", () => {
		const child = makeUiRow("child-nested", {
			type: "text",
			title: "Child",
			text: "c",
		});
		const sheet = makeUiRow("sheet-nested", {
			type: "text",
			title: "Sheet",
			text: "s",
		});
		const search = makeUiRow("search-2", {
			type: "search",
			child,
			sheet,
		});
		const records = rowToFlatRecords(search, NOW);
		expect(records.map((r) => r.id).sort()).toEqual(
			["child-nested", "search-2", "sheet-nested"].sort(),
		);
		const searchRecord = records.find((r) => r.id === "search-2");
		expect(searchRecord).toBeDefined();
		const rebuilt = buildRowConfigFromRecord(
			searchRecord as NonNullable<typeof searchRecord>,
		);
		expect(rebuilt.child_row_id).toBe("child-nested");
		expect(rebuilt.sheet_row_id).toBe("sheet-nested");
	});

	it("round-trips Search template variants via children_row_ids", () => {
		const search = makeUiRow("search-variants", {
			type: "search",
			children_row_ids: ["variant-a", "variant-b"],
		});
		const records = rowToFlatRecords(search, NOW);
		const searchRecord = records.find((r) => r.id === "search-variants");
		expect(searchRecord?.data.children_row_ids).toEqual([
			"variant-a",
			"variant-b",
		]);

		const rebuilt = buildRowConfigFromRecord(
			searchRecord as NonNullable<typeof searchRecord>,
		);
		expect(rebuilt.children_row_ids).toEqual(["variant-a", "variant-b"]);
	});
});
