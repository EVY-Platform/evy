import { describe, expect, it } from "bun:test";

import type { UI_Page } from "../types/flow";
import type { Row } from "../types/row";
import {
	buildUrlPath,
	isNonRoutablePreviewRowId,
	validateRowPathSegmentsForPage,
} from "./urlUtils";

function textRow(id: string): Row {
	return {
		id,
		row: null,
		config: {
			type: "Text",
			source: "",
			actions: [],
			view: {
				content: { title: "", text: "" },
				max_lines: "",
			},
		} as Row["config"],
	};
}

describe("isNonRoutablePreviewRowId", () => {
	it("rejects search preview synthetic ids", () => {
		expect(isNonRoutablePreviewRowId("s:search-preview:0")).toBe(true);
		expect(isNonRoutablePreviewRowId("search-row:search-preview-default")).toBe(
			true,
		);
		expect(isNonRoutablePreviewRowId("row-1")).toBe(false);
	});
});

describe("validateRowPathSegmentsForPage", () => {
	it("accepts a valid parent-child chain and truncates invalid tail", () => {
		const child = textRow("child-1");
		const list: Row = {
			id: "list-1",
			row: null,
			config: {
				type: "ListContainer",
				source: "",
				actions: [],
				view: {
					content: {
						title: "",
						children: [child],
					},
				},
			} as Row["config"],
		};
		const page: UI_Page = {
			id: "p1",
			title: "P",
			rows: [list],
		};
		expect(validateRowPathSegmentsForPage(page, ["list-1", "child-1"])).toEqual(
			{
				rootRowId: "list-1",
				configStack: ["child-1"],
			},
		);
		expect(
			validateRowPathSegmentsForPage(page, ["list-1", "child-1", "nope"]),
		).toEqual({
			rootRowId: "list-1",
			configStack: ["child-1"],
		});
	});

	it("returns null when only preview ids are present", () => {
		const page: UI_Page = {
			id: "p1",
			title: "P",
			rows: [textRow("row-1")],
		};
		expect(
			validateRowPathSegmentsForPage(page, ["x:search-preview:0"]),
		).toBeNull();
	});

	it("filters preview segments and validates the remainder", () => {
		const page: UI_Page = {
			id: "p1",
			title: "P",
			rows: [textRow("row-1")],
		};
		expect(
			validateRowPathSegmentsForPage(page, ["row-1", "x:search-preview:0"]),
		).toEqual({
			rootRowId: "row-1",
			configStack: [],
		});
	});

	it("accepts a valid child chain", () => {
		const leaf = textRow("leaf-child");
		const middle: Row = {
			id: "middle-child",
			row: null,
			config: {
				type: "ListContainer",
				source: "",
				actions: [],
				view: {
					content: {
						title: "",
						child: leaf,
					},
				},
			} as Row["config"],
		};
		const root: Row = {
			id: "root-parent",
			row: null,
			config: {
				type: "ListContainer",
				source: "",
				actions: [],
				view: {
					content: {
						title: "",
						child: middle,
					},
				},
			} as Row["config"],
		};
		const page: UI_Page = {
			id: "p1",
			title: "P",
			rows: [root],
		};
		expect(
			validateRowPathSegmentsForPage(page, [
				"root-parent",
				"middle-child",
				"leaf-child",
			]),
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
