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
			type: "Search",
			actions: {},
			visible: "true",
			title: "Search",
			source: "",
			destination: "",
			...config,
		} as Row["config"],
	};
}

describe("rowCodec", () => {
	it("serializes empty actions in row data", () => {
		const row = makeUiRow("row-actions", { type: "Search", actions: {} });
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
			type: "Search",
			childRowId: "child-1",
			sheetRowId: "sheet-1",
		});
		const records = rowToFlatRecords(search, NOW);
		const searchRecord = records.find((r) => r.id === "search-1");
		expect(searchRecord?.data.child_row_id).toBe("child-1");
		expect(searchRecord?.data.sheet_row_id).toBe("sheet-1");
	});

	it("decomposes nested child and sheet rows into separate records", () => {
		const child = makeUiRow("child-nested", {
			type: "Text",
			title: "Child",
			text: "c",
		});
		const sheet = makeUiRow("sheet-nested", {
			type: "Text",
			title: "Sheet",
			text: "s",
		});
		const search = makeUiRow("search-2", {
			type: "Search",
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
		expect(rebuilt.childRowId).toBe("child-nested");
		expect(rebuilt.sheetRowId).toBe("sheet-nested");
	});
});
