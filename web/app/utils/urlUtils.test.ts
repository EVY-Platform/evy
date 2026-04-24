import { describe, expect, it } from "bun:test";

import type { UI_Page } from "../types/flow";
import type { Row } from "../types/row";
import {
	buildUrlPath,
	deriveSheetAndFocusFromRowChain,
	isNonRoutablePreviewRowId,
	resolveCanonicalPageIdForUrl,
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

describe("deriveSheetAndFocusFromRowChain", () => {
	it("sets focus when chain crosses SheetContainer child boundary", () => {
		const inner = textRow("inner");
		const sheet: Row = {
			id: "sheet-1",
			row: null,
			config: {
				type: "SheetContainer",
				source: "",
				actions: [],
				view: {
					content: {
						title: "S",
						child: inner,
						children: [],
					},
				},
			} as Row["config"],
		};
		const pages: UI_Page[] = [{ id: "p1", title: "P", rows: [sheet] }];
		expect(
			deriveSheetAndFocusFromRowChain(pages, "sheet-1", ["inner"]),
		).toEqual({
			focusMode: true,
			secondarySheetRowId: "sheet-1",
		});
	});
});

describe("resolveCanonicalPageIdForUrl", () => {
	it("maps secondary pseudo page id to the host canvas page", () => {
		const sheet: Row = {
			id: "sheet-host",
			row: null,
			config: {
				type: "SheetContainer",
				source: "",
				actions: [],
				view: {
					content: { title: "", child: undefined, children: [] },
				},
			} as Row["config"],
		};
		const flows = [
			{
				id: "flow-1",
				name: "F",
				pages: [{ id: "real-page", title: "P", rows: [sheet] }],
			},
		];
		expect(
			resolveCanonicalPageIdForUrl(flows, "flow-1", "secondary:sheet-host"),
		).toBe("real-page");
	});
});
