import { describe, expect, it } from "bun:test";

import type { UI_Page } from "../types/flow";
import type { Row } from "../types/row";
import {
	findContainerByIdInPage,
	findContainerOfRowInPage,
	findPageContainingRow,
	findRowIdPathFromPageRoot,
	findRowInPages,
	getRowsInPage,
	getRowsRecursive,
	insertRowIntoPage,
	removeRowFromPage,
	resolveDestinationPageFromRawPageId,
	updateRowInTree,
} from "./rowTree";

function makeRow(
	id: string,
	contentOverrides: Partial<Row["config"]> = {},
): Row {
	return {
		id,
		row: null,
		config: {
			type: "Text",
			source: "",
			visible: "true",
			actions: [],
			title: "",
			text: "",
			...contentOverrides,
		} as Row["config"],
	};
}

function page(id: string, rows: Row[], footer?: Row): UI_Page {
	return { id, title: "T", rows, footer };
}

describe("page id resolution", () => {
	it("resolves a raw page id to its page", () => {
		const pages = [page("main", [makeRow("row-1")])];

		const destination = resolveDestinationPageFromRawPageId("main", pages);
		expect(destination.resolvedPageId).toBe("main");
	});
});

describe("row tree traversal", () => {
	it("finds nested rows and root-to-leaf paths including footer descendants", () => {
		const bodyLeaf = makeRow("body-leaf");
		const footerLeaf = makeRow("footer-leaf");
		const bodyRoot = makeRow("body-root", { children: [bodyLeaf] });
		const footerRoot = makeRow("footer-root", { child: footerLeaf });
		const p = page("p", [bodyRoot], footerRoot);

		expect(findRowInPages("body-leaf", [p])).toBe(bodyLeaf);
		expect(findRowInPages("footer-leaf", [p])).toBe(footerLeaf);
		expect(findRowIdPathFromPageRoot(p, "footer-leaf")).toEqual([
			"footer-root",
			"footer-leaf",
		]);
	});

	it("flattens a row subtree", () => {
		const leaf = makeRow("leaf");
		const mid = makeRow("mid", { children: [leaf] });
		const root = makeRow("root", { child: mid });

		expect(getRowsRecursive(root).map((row) => row.id)).toEqual([
			"root",
			"mid",
			"leaf",
		]);
	});

	it("updates nested rows immutably", () => {
		const inner = makeRow("inner", { text: "old" });
		const outer = makeRow("outer", { child: inner });
		const out = updateRowInTree([outer], "inner", (row) =>
			makeRow(row.id, { ...row.config, text: "new" }),
		);

		expect(out[0]).not.toBe(outer);
		expect(out[0].config.child?.config.text).toBe("new");
	});
});

describe("page-level row tree helpers", () => {
	it("finds containers in page rows and footer subtrees", () => {
		const bodyChild = makeRow("body-child");
		const footerChild = makeRow("footer-child");
		const bodyContainer = makeRow("body-container", {
			children: [bodyChild],
		});
		const footerContainer = makeRow("footer-container", {
			child: footerChild,
		});
		const p = page("p", [bodyContainer], footerContainer);

		expect(findContainerOfRowInPage(p, "body-child")?.container.id).toBe(
			"body-container",
		);
		expect(findContainerOfRowInPage(p, "footer-child")?.container.id).toBe(
			"footer-container",
		);
		expect(findContainerByIdInPage(p, "footer-container")?.type).toBe(
			"child",
		);
		expect(findContainerOfRowInPage(p, "footer-container")).toBeNull();
	});

	it("removes rows from page roots, footer roots, and nested footer content", () => {
		const footerChild = makeRow("footer-child");
		const footer = makeRow("footer", { child: footerChild });
		const withoutBody = removeRowFromPage(
			page("p", [makeRow("body")], footer),
			"body",
		);
		const withoutFooterChild = removeRowFromPage(
			page("p", [], footer),
			"footer-child",
		);
		const withoutFooter = removeRowFromPage(
			page("p", [], footer),
			"footer",
		);

		expect(withoutBody.rows).toEqual([]);
		expect(withoutFooterChild.footer?.config.child).toBeUndefined();
		expect(withoutFooter.footer).toBeUndefined();
	});

	it("inserts rows at page root and inside footer containers", () => {
		const pageInsert = insertRowIntoPage(
			page("p", [makeRow("a")]),
			makeRow("b"),
			0,
		);
		const footerInsert = insertRowIntoPage(
			page("p", [], makeRow("footer", { children: [] })),
			makeRow("new"),
			0,
			{ rowId: "footer", type: "children" },
		);

		expect(pageInsert.rows.map((row) => row.id)).toEqual(["b", "a"]);
		expect(footerInsert.footer?.config.children?.[0].id).toBe("new");
	});
});

describe("getRowsInPage", () => {
	it("returns body rows and footer descendants", () => {
		const bodyChild = makeRow("body-child");
		const bodyRoot = makeRow("body-root", { children: [bodyChild] });
		const footerDescendant = makeRow("footer-descendant");
		const footerRoot = makeRow("footer-root", { child: footerDescendant });
		const p = page("p", [bodyRoot], footerRoot);

		const result = getRowsInPage(p);
		expect(result.map((r) => r.id)).toEqual([
			"body-root",
			"body-child",
			"footer-root",
			"footer-descendant",
		]);
	});

	it("returns only body rows when there is no footer", () => {
		const bodyRow = makeRow("body-row");
		const p = page("p", [bodyRow]);

		expect(getRowsInPage(p).map((r) => r.id)).toEqual(["body-row"]);
	});

	it("returns only footer rows when there are no body rows", () => {
		const footerRow = makeRow("footer-row");
		const p = page("p", [], footerRow);

		expect(getRowsInPage(p).map((r) => r.id)).toEqual(["footer-row"]);
	});

	it("includes deeply nested rows in footer", () => {
		const deepChild = makeRow("deep-child");
		const midChild = makeRow("mid-child", { child: deepChild });
		const footerRoot = makeRow("footer-root", { children: [midChild] });
		const p = page("p", [], footerRoot);

		expect(getRowsInPage(p).map((r) => r.id)).toEqual([
			"footer-root",
			"mid-child",
			"deep-child",
		]);
	});
});

describe("findPageContainingRow", () => {
	it("finds a page by a row in its body", () => {
		const row = makeRow("target");
		const p1 = page("p1", [makeRow("a")]);
		const p2 = page("p2", [row]);

		expect(findPageContainingRow([p1, p2], "target")).toBe(p2);
	});

	it("finds a page by a row in its footer subtree", () => {
		const footerChild = makeRow("footer-child");
		const footerRoot = makeRow("footer-root", { child: footerChild });
		const p1 = page("p1", [makeRow("a")]);
		const p2 = page("p2", [makeRow("b")], footerRoot);

		expect(findPageContainingRow([p1, p2], "footer-child")).toBe(p2);
	});

	it("finds a page by a deeply nested footer descendant", () => {
		const deepChild = makeRow("deep");
		const mid = makeRow("mid", { child: deepChild });
		const footerRoot = makeRow("footer-root", { child: mid });
		const p = page("p", [makeRow("a")], footerRoot);

		expect(findPageContainingRow([p], "deep")).toBe(p);
	});

	it("finds a page by a row nested in array children of footer", () => {
		const childRow = makeRow("child");
		const footerRoot = makeRow("footer-root", { children: [childRow] });
		const p = page("p", [], footerRoot);

		expect(findPageContainingRow([p], "child")).toBe(p);
	});

	it("returns undefined when row is not in any page", () => {
		const p = page("p", [makeRow("a")]);

		expect(findPageContainingRow([p], "nonexistent")).toBeUndefined();
	});
});
