import { describe, expect, it } from "bun:test";

import type { SDUI_Page } from "../types/flow";
import type { Row } from "../types/row";
import {
	findContainerById,
	findContainerOfRow,
	findRowInPages,
	getRowsRecursive,
	insertRowIntoTree,
	removeRowFromTree,
	resolveDestinationPageFromRawPageId,
	resolveSourcePageIdFromRaw,
	updateRowInTree,
} from "./rowTree";

function makeRow(
	id: string,
	contentOverrides: Partial<Row["config"]["view"]["content"]> = {},
): Row {
	return {
		id,
		row: null,
		config: {
			type: "Text",
			actions: [],
			view: {
				content: {
					title: "",
					text: "",
					...contentOverrides,
				} as Row["config"]["view"]["content"],
			},
		} as Row["config"],
	};
}

function page(id: string, rows: Row[]): SDUI_Page {
	return { id, title: "T", rows };
}

describe("resolveSourcePageIdFromRaw", () => {
	it("returns raw id when not a secondary pseudo page", () => {
		const pages = [page("p1", [makeRow("a")])];
		expect(resolveSourcePageIdFromRaw("p1", pages)).toBe("p1");
	});

	it("maps secondary:hostRowId to the page that contains the host row at top level", () => {
		const host = makeRow("sheet-host");
		const pages = [page("main", [host])];
		expect(resolveSourcePageIdFromRaw("secondary:sheet-host", pages)).toBe(
			"main",
		);
	});

	it("falls back to raw id when host row is not found", () => {
		const pages = [page("main", [makeRow("a")])];
		expect(resolveSourcePageIdFromRaw("secondary:missing", pages)).toBe(
			"secondary:missing",
		);
	});
});

describe("resolveDestinationPageFromRawPageId", () => {
	it("resolves normal page id", () => {
		const pages = [page("p1", [])];
		const res = resolveDestinationPageFromRawPageId("p1", pages);
		expect(res.page.id).toBe("p1");
		expect(res.resolvedPageId).toBe("p1");
		expect(res.secondarySheetRowId).toBeUndefined();
	});

	it("resolves secondary sheet to host page", () => {
		const host = makeRow("host");
		const pages = [page("p1", [host])];
		const res = resolveDestinationPageFromRawPageId("secondary:host", pages);
		expect(res.page.id).toBe("p1");
		expect(res.resolvedPageId).toBe("p1");
		expect(res.secondarySheetRowId).toBe("host");
	});
});

describe("findRowInPages", () => {
	it("finds top-level row", () => {
		const a = makeRow("a");
		expect(findRowInPages("a", [page("p", [a])])).toBe(a);
	});

	it("finds nested child", () => {
		const inner = makeRow("inner");
		const outer = makeRow("outer", { child: inner });
		expect(findRowInPages("inner", [page("p", [outer])])).toBe(inner);
	});

	it("finds nested children", () => {
		const c = makeRow("c");
		const outer = makeRow("outer", { children: [c] });
		expect(findRowInPages("c", [page("p", [outer])])).toBe(c);
	});

	it("returns undefined when missing", () => {
		expect(findRowInPages("x", [page("p", [makeRow("a")])])).toBeUndefined();
	});
});

describe("getRowsRecursive", () => {
	it("includes self and descendants", () => {
		const leaf = makeRow("leaf");
		const mid = makeRow("mid", { children: [leaf] });
		const root = makeRow("root", { child: mid });
		const flat = getRowsRecursive(root).map((r) => r.id);
		expect(flat).toEqual(["root", "mid", "leaf"]);
	});
});

describe("findContainerOfRow", () => {
	it("returns null for top-level row", () => {
		const rows = [makeRow("a")];
		expect(findContainerOfRow("a", rows)).toBeNull();
	});

	it("finds child container", () => {
		const inner = makeRow("inner");
		const outer = makeRow("outer", { child: inner });
		const res = findContainerOfRow("inner", [outer]);
		expect(res?.container.id).toBe("outer");
		expect(res?.type).toBe("child");
	});

	it("finds children container", () => {
		const c = makeRow("c");
		const outer = makeRow("outer", { children: [c] });
		const res = findContainerOfRow("c", [outer]);
		expect(res?.container.id).toBe("outer");
		expect(res?.type).toBe("children");
	});
});

describe("findContainerById", () => {
	it("finds row that is a child slot container", () => {
		const inner = makeRow("inner");
		const outer = makeRow("outer", { child: inner });
		const res = findContainerById("outer", [outer]);
		expect(res?.type).toBe("child");
	});

	it("finds row that is a children slot container", () => {
		const c = makeRow("c");
		const outer = makeRow("outer", { children: [c] });
		const res = findContainerById("outer", [outer]);
		expect(res?.type).toBe("children");
	});
});

describe("removeRowFromTree", () => {
	it("removes top-level row", () => {
		const a = makeRow("a");
		const b = makeRow("b");
		const out = removeRowFromTree([a, b], "a");
		expect(out.map((r) => r.id)).toEqual(["b"]);
	});

	it("removes nested child", () => {
		const inner = makeRow("inner");
		const outer = makeRow("outer", { child: inner });
		const out = removeRowFromTree([outer], "inner");
		expect(out[0].config.view.content.child).toBeUndefined();
	});

	it("removes from children array", () => {
		const c1 = makeRow("c1");
		const c2 = makeRow("c2");
		const outer = makeRow("outer", { children: [c1, c2] });
		const out = removeRowFromTree([outer], "c1");
		const children = out[0].config.view.content.children ?? [];
		expect(children.map((r) => r.id)).toEqual(["c2"]);
	});
});

describe("insertRowIntoTree", () => {
	it("inserts at page root index", () => {
		const a = makeRow("a");
		const b = makeRow("b");
		const res = insertRowIntoTree([a], b, 0);
		expect(res.inserted).toBe(true);
		expect(res.rows.map((r) => r.id)).toEqual(["b", "a"]);
	});

	it("inserts into child container", () => {
		const outer = makeRow("outer", {});
		const insert = makeRow("new");
		const res = insertRowIntoTree([outer], insert, 0, {
			rowId: "outer",
			type: "child",
		});
		expect(res.inserted).toBe(true);
		expect(res.rows[0].config.view.content.child?.id).toBe("new");
	});

	it("inserts into children container at index", () => {
		const outer = makeRow("outer", { children: [] });
		const insert = makeRow("new");
		const res = insertRowIntoTree([outer], insert, 0, {
			rowId: "outer",
			type: "children",
		});
		expect(res.inserted).toBe(true);
		expect(res.rows[0].config.view.content.children?.map((r) => r.id)).toEqual([
			"new",
		]);
	});

	it("returns inserted false when container missing", () => {
		const res = insertRowIntoTree([makeRow("a")], makeRow("b"), 0, {
			rowId: "nope",
			type: "children",
		});
		expect(res.inserted).toBe(false);
	});
});

describe("updateRowInTree", () => {
	it("updates matching row at depth", () => {
		const inner = makeRow("inner", { text: "old" });
		const outer = makeRow("outer", { child: inner });
		const out = updateRowInTree([outer], "inner", (row) =>
			makeRow(row.id, { ...row.config.view.content, text: "new" }),
		);
		expect(out[0].config.view.content.child?.config.view.content.text).toBe(
			"new",
		);
	});
});
