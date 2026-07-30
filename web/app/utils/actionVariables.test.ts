import { describe, expect, it } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { extractDraftVariables } from "./actionVariables";

function makeRow(id: string, data: Record<string, unknown> = {}): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "input",
		visible: "true",
		data: data as DATA_EVY_Row["data"],
		created_at: "",
		updated_at: "",
		visibility: "public",
	};
}

describe("extractDraftVariables", () => {
	it("collects destinations from child, sheet, and children subtrees", () => {
		const sheetLeaf = makeRow("sheet-leaf", {
			destination: "{sheetDraft}",
		});
		const childLeaf = makeRow("child-leaf", {
			destination: "{childDraft}",
		});
		const listChild = makeRow("list-child", {
			destination: "{listDraft}",
		});
		const root = makeRow("root", {
			destination: "{rootDraft}",
			child_row_id: "child-leaf",
			sheet_row_id: "sheet-leaf",
			children_row_ids: ["list-child"],
		});

		const flow: DATA_EVY_Flow = {
			id: "f1",
			name: "Flow",
			page_ids: ["p1"],
			visibility: "public",
			created_at: "",
			updated_at: "",
		};
		const page: DATA_EVY_Page = {
			id: "p1",
			name: "Page",
			title: "Page",
			row_ids: ["root"],
			visibility: "public",
			created_at: "",
			updated_at: "",
		};
		const rowsById = {
			root,
			"child-leaf": childLeaf,
			"sheet-leaf": sheetLeaf,
			"list-child": listChild,
		};

		expect(
			extractDraftVariables({ f1: flow }, { p1: page }, rowsById, "f1"),
		).toEqual(["childDraft", "listDraft", "rootDraft", "sheetDraft"]);
	});
});
