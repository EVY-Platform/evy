import { describe, expect, it } from "bun:test";

import type { DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	buildUrlPath,
	isNonRoutablePreviewRowId,
	validateRowPathSegmentsForPage,
} from "./urlUtils";

function makeDataRow(
	id: string,
	data: Record<string, unknown> = {},
): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "Text",
		visible: "true",
		data: data as DATA_EVY_Row["data"],
		createdAt: "",
		updatedAt: "",
		visibility: "public",
	};
}

function makePage(
	id: string,
	rowIds: string[],
	footerRowId?: string,
): DATA_EVY_Page {
	return {
		id,
		name: id,
		title: "P",
		rowIds,
		...(footerRowId ? { footerRowId } : {}),
		createdAt: "",
		updatedAt: "",
		visibility: "public",
	};
}

describe("isNonRoutablePreviewRowId", () => {
	it("rejects search preview synthetic ids", () => {
		expect(isNonRoutablePreviewRowId("s:search-preview:0")).toBe(true);
		expect(
			isNonRoutablePreviewRowId("search-row:search-preview-default"),
		).toBe(true);
		expect(isNonRoutablePreviewRowId("row-1")).toBe(false);
	});
});

describe("validateRowPathSegmentsForPage", () => {
	it("accepts a valid parent-child chain and truncates invalid tail", () => {
		const childRow = makeDataRow("child-1");
		const listRow = makeDataRow("list-1", {
			children_row_ids: ["child-1"],
		});
		const page = makePage("p1", ["list-1"]);
		const pagesById = { p1: page };
		const rowsById = { "list-1": listRow, "child-1": childRow };

		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["list-1", "child-1"],
				pagesById,
				rowsById,
			),
		).toEqual({
			rootRowId: "list-1",
			configStack: ["child-1"],
		});
		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["list-1", "child-1", "nope"],
				pagesById,
				rowsById,
			),
		).toEqual({
			rootRowId: "list-1",
			configStack: ["child-1"],
		});
	});

	it("returns null when only preview ids are present", () => {
		const row = makeDataRow("row-1");
		const page = makePage("p1", ["row-1"]);
		const pagesById = { p1: page };
		const rowsById = { "row-1": row };

		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["x:search-preview:0"],
				pagesById,
				rowsById,
			),
		).toBeNull();
	});

	it("filters preview segments and validates the remainder", () => {
		const row = makeDataRow("row-1");
		const page = makePage("p1", ["row-1"]);
		const pagesById = { p1: page };
		const rowsById = { "row-1": row };

		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["row-1", "x:search-preview:0"],
				pagesById,
				rowsById,
			),
		).toEqual({
			rootRowId: "row-1",
			configStack: [],
		});
	});

	it("accepts a valid sheet chain", () => {
		const sheetLeaf = makeDataRow("sheet-leaf");
		const rootRow = makeDataRow("root-parent", {
			sheet_row_id: "sheet-leaf",
		});
		const page = makePage("p1", ["root-parent"]);
		const pagesById = { p1: page };
		const rowsById = {
			"root-parent": rootRow,
			"sheet-leaf": sheetLeaf,
		};

		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["root-parent", "sheet-leaf"],
				pagesById,
				rowsById,
			),
		).toEqual({
			rootRowId: "root-parent",
			configStack: ["sheet-leaf"],
		});
	});

	it("accepts a valid child chain", () => {
		const leafRow = makeDataRow("leaf-child");
		const middleRow = makeDataRow("middle-child", {
			child_row_id: "leaf-child",
		});
		const rootRow = makeDataRow("root-parent", {
			child_row_id: "middle-child",
		});
		const page = makePage("p1", ["root-parent"]);
		const pagesById = { p1: page };
		const rowsById = {
			"root-parent": rootRow,
			"middle-child": middleRow,
			"leaf-child": leafRow,
		};

		expect(
			validateRowPathSegmentsForPage(
				"p1",
				["root-parent", "middle-child", "leaf-child"],
				pagesById,
				rowsById,
			),
		).toEqual({
			rootRowId: "root-parent",
			configStack: ["middle-child", "leaf-child"],
		});
	});
});

describe("buildUrlPath", () => {
	it("appends row segments after flow and page", () => {
		expect(buildUrlPath("f", "p", ["a", "b"])).toBe("/f/p/a/b");
	});

	it("omits preview row ids from the path", () => {
		expect(buildUrlPath("f", "p", ["ok", "bad:search-preview:0"])).toBe(
			"/f/p/ok",
		);
	});
});
