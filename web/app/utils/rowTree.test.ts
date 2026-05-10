import { describe, expect, it } from "bun:test";

import type { UI_Page } from "../types/flow";
import type { Row } from "../types/row";
import {
	findContainerByIdInPage,
	findContainerOfRowInPage,
	findRowIdPathFromPageRoot,
	findRowInPages,
	getRowsRecursive,
	insertRowIntoPage,
	removeRowFromPage,
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
			source: "",
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

function page(id: string, rows: Row[], footer?: Row): UI_Page {
	return { id, title: "T", rows, footer };
}

describe("secondary sheet page ids", () => {
	it("resolves secondary pseudo ids to the page containing the sheet row", () => {
		const pages = [page("main", [makeRow("sheet-host")])];

		expect(resolveSourcePageIdFromRaw("secondary:sheet-host", pages)).toBe(
			"main",
		);

		const destination = resolveDestinationPageFromRawPageId(
			"secondary:sheet-host",
			pages,
		);
		expect(destination.resolvedPageId).toBe("main");
		expect(destination.secondarySheetRowId).toBe("sheet-host");
	});

	it("falls back to the raw source id when the sheet row is missing", () => {
		expect(resolveSourcePageIdFromRaw("secondary:missing", [])).toBe(
			"secondary:missing",
		);
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
			makeRow(row.id, { ...row.config.view.content, text: "new" }),
		);

		expect(out[0]).not.toBe(outer);
		expect(out[0].config.view.content.child?.config.view.content.text).toBe(
			"new",
		);
	});
});

describe("page-level row tree helpers", () => {
	it("finds containers in page rows and footer subtrees", () => {
		const bodyChild = makeRow("body-child");
		const footerChild = makeRow("footer-child");
		const bodyContainer = makeRow("body-container", { children: [bodyChild] });
		const footerContainer = makeRow("footer-container", { child: footerChild });
		const p = page("p", [bodyContainer], footerContainer);

		expect(findContainerOfRowInPage(p, "body-child")?.container.id).toBe(
			"body-container",
		);
		expect(findContainerOfRowInPage(p, "footer-child")?.container.id).toBe(
			"footer-container",
		);
		expect(findContainerByIdInPage(p, "footer-container")?.type).toBe("child");
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
		const withoutFooter = removeRowFromPage(page("p", [], footer), "footer");

		expect(withoutBody.rows).toEqual([]);
		expect(
			withoutFooterChild.footer?.config.view.content.child,
		).toBeUndefined();
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
		expect(footerInsert.footer?.config.view.content.children?.[0].id).toBe(
			"new",
		);
	});
});
