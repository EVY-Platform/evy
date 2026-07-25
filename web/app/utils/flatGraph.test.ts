import { describe, expect, it } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import {
	addFlowRecords,
	addPage,
	addRowRecords,
	applyRemoteRecord,
	collectSubtreeRowIds,
	ensureShowAction,
	findChildIndexInContainer,
	findContainerByIdInPage,
	findContainerOfRowInPage,
	findPageContainingRow,
	findPageIdContainingRow,
	findRowIdPath,
	insertIntoLocation,
	moveRow,
	moveRowToFooter,
	removePage,
	removeRowFromPage,
	setFooterRow,
	updateFlowSubmits,
	updatePageTitle,
	updateRowActions,
	updateRowField,
} from "./flatGraph";
import type { FlowEntityMaps } from "./flowEntities";
import { pageRootIds } from "./rowTraversal";

const NOW = "2024-01-01T00:00:00.000Z";

function makeFlow(id: string, pageIds: string[]): DATA_EVY_Flow {
	return {
		id,
		name: "Flow",
		pageIds,
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function makePage(
	id: string,
	rowIds: string[],
	footerRowId?: string,
): DATA_EVY_Page {
	return {
		id,
		name: "Page",
		title: "",
		rowIds,
		footerRowId,
		createdAt: NOW,
		updatedAt: NOW,
		visibility: "public",
	};
}

function makeRow(id: string, data: Record<string, unknown> = {}): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "Text",
		visible: "true",
		data,
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function makeMaps(
	flows: DATA_EVY_Flow[],
	pages: DATA_EVY_Page[],
	rows: DATA_EVY_Row[],
): FlowEntityMaps {
	return {
		flowsById: Object.fromEntries(flows.map((f) => [f.id, f])),
		pagesById: Object.fromEntries(pages.map((p) => [p.id, p])),
		rowsById: Object.fromEntries(rows.map((r) => [r.id, r])),
	};
}

// ---------------------------------------------------------------------------
// collectSubtreeRowIds
// ---------------------------------------------------------------------------

describe("collectSubtreeRowIds", () => {
	it("collects just the row itself when no children", () => {
		const row = makeRow("r1");
		const maps = makeMaps([], [], [row]);
		const ids = collectSubtreeRowIds("r1", maps.rowsById);
		expect([...ids]).toEqual(["r1"]);
	});

	it("collects child_row_id, sheet_row_id and children_row_ids recursively", () => {
		const child = makeRow("child");
		const sheet = makeRow("sheet");
		const grandchild = makeRow("grandchild");
		const container = makeRow("container", {
			child_row_id: "child",
			sheet_row_id: "sheet",
			children_row_ids: ["grandchild"],
		});
		const maps = makeMaps([], [], [container, child, sheet, grandchild]);
		const ids = collectSubtreeRowIds("container", maps.rowsById);
		expect([...ids].sort()).toEqual(
			["child", "container", "grandchild", "sheet"].sort(),
		);
	});

	it("collects child_row_id and children_row_ids recursively", () => {
		const child = makeRow("child");
		const grandchild = makeRow("grandchild");
		const container = makeRow("container", {
			child_row_id: "child",
			children_row_ids: ["grandchild"],
		});
		const maps = makeMaps([], [], [container, child, grandchild]);
		const ids = collectSubtreeRowIds("container", maps.rowsById);
		expect([...ids].sort()).toEqual(
			["child", "container", "grandchild"].sort(),
		);
	});

	it("is cycle-safe", () => {
		// Pathological: row points to itself
		const row = makeRow("r", { child_row_id: "r" });
		const maps = makeMaps([], [], [row]);
		const ids = collectSubtreeRowIds("r", maps.rowsById);
		expect([...ids]).toEqual(["r"]);
	});
});

// ---------------------------------------------------------------------------
// findRowIdPath
// ---------------------------------------------------------------------------

describe("findRowIdPath", () => {
	it("finds path to a body root row", () => {
		const row = makeRow("r1");
		const maps = makeMaps([], [], [row]);
		const path = findRowIdPath(maps.rowsById, ["r1"], "r1");
		expect(path).toEqual(["r1"]);
	});

	it("finds path through sheet_row_id", () => {
		const leaf = makeRow("leaf");
		const root = makeRow("root", { sheet_row_id: "leaf" });
		const maps = makeMaps([], [], [root, leaf]);
		const path = findRowIdPath(maps.rowsById, ["root"], "leaf");
		expect(path).toEqual(["root", "leaf"]);
	});

	it("finds path through child_row_id", () => {
		const leaf = makeRow("leaf");
		const root = makeRow("root", { child_row_id: "leaf" });
		const maps = makeMaps([], [], [root, leaf]);
		const path = findRowIdPath(maps.rowsById, ["root"], "leaf");
		expect(path).toEqual(["root", "leaf"]);
	});

	it("finds path through children_row_ids", () => {
		const child = makeRow("child");
		const root = makeRow("root", { children_row_ids: ["child"] });
		const maps = makeMaps([], [], [root, child]);
		const path = findRowIdPath(maps.rowsById, ["root"], "child");
		expect(path).toEqual(["root", "child"]);
	});

	it("returns null when row not found", () => {
		const maps = makeMaps([], [], []);
		expect(findRowIdPath(maps.rowsById, ["r1"], "missing")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// findPageIdContainingRow
// ---------------------------------------------------------------------------

describe("findPageIdContainingRow", () => {
	it("finds the page containing a body row", () => {
		const flow = makeFlow("f1", ["p1", "p2"]);
		const p1 = makePage("p1", ["r1"]);
		const p2 = makePage("p2", ["r2"]);
		const r1 = makeRow("r1");
		const r2 = makeRow("r2");
		const maps = makeMaps([flow], [p1, p2], [r1, r2]);
		expect(findPageIdContainingRow(maps, "f1", "r2")).toBe("p2");
	});

	it("finds the page containing a footer row", () => {
		const flow = makeFlow("f1", ["p1"]);
		const p1 = makePage("p1", [], "footer");
		const footer = makeRow("footer");
		const maps = makeMaps([flow], [p1], [footer]);
		expect(findPageIdContainingRow(maps, "f1", "footer")).toBe("p1");
	});

	it("finds the page for a nested child", () => {
		const flow = makeFlow("f1", ["p1"]);
		const child = makeRow("child");
		const parent = makeRow("parent", { child_row_id: "child" });
		const p1 = makePage("p1", ["parent"]);
		const maps = makeMaps([flow], [p1], [parent, child]);
		expect(findPageIdContainingRow(maps, "f1", "child")).toBe("p1");
	});

	it("returns undefined for a missing row", () => {
		const flow = makeFlow("f1", ["p1"]);
		const p1 = makePage("p1", []);
		const maps = makeMaps([flow], [p1], []);
		expect(findPageIdContainingRow(maps, "f1", "missing")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// findContainerOfRowInPage
// ---------------------------------------------------------------------------

describe("findContainerOfRowInPage", () => {
	it("finds a children container for a body row", () => {
		const child = makeRow("child");
		const container = makeRow("container", {
			children_row_ids: ["child"],
		});
		const page = makePage("p1", ["container"]);
		const maps = makeMaps([], [page], [container, child]);
		const result = findContainerOfRowInPage(maps, page, "child");
		expect(result).toEqual({
			containerRowId: "container",
			type: "children",
		});
	});

	it("finds a child container in footer subtree", () => {
		const leaf = makeRow("leaf");
		const footerRoot = makeRow("footer-root", { child_row_id: "leaf" });
		const page = makePage("p1", [], "footer-root");
		const maps = makeMaps([], [page], [footerRoot, leaf]);
		const result = findContainerOfRowInPage(maps, page, "leaf");
		expect(result).toEqual({
			containerRowId: "footer-root",
			type: "child",
		});
	});

	it("does NOT report footer root as its own container", () => {
		const footer = makeRow("footer");
		const page = makePage("p1", [], "footer");
		const maps = makeMaps([], [page], [footer]);
		expect(findContainerOfRowInPage(maps, page, "footer")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// findContainerByIdInPage
// ---------------------------------------------------------------------------

describe("findContainerByIdInPage", () => {
	it("identifies a children container by its own id", () => {
		const container = makeRow("container", { children_row_ids: [] });
		const page = makePage("p1", ["container"]);
		const maps = makeMaps([], [page], [container]);
		const result = findContainerByIdInPage(maps, page, "container");
		expect(result?.type).toBe("children");
	});

	it("identifies a child container by its own id", () => {
		const container = makeRow("container", { child_row_id: "leaf" });
		const leaf = makeRow("leaf");
		const page = makePage("p1", ["container"]);
		const maps = makeMaps([], [page], [container, leaf]);
		const result = findContainerByIdInPage(maps, page, "container");
		expect(result?.type).toBe("child");
	});
});

// ---------------------------------------------------------------------------
// insertIntoLocation
// ---------------------------------------------------------------------------

describe("insertIntoLocation", () => {
	it("inserts a row into page rowIds at the given index", () => {
		const r1 = makeRow("r1");
		const r2 = makeRow("r2");
		const newRow = makeRow("new");
		const page = makePage("p1", ["r1", "r2"]);
		const maps = makeMaps([], [page], [r1, r2, newRow]);
		const next = insertIntoLocation(maps, "p1", "new", 1);
		expect(next.pagesById.p1?.rowIds).toEqual(["r1", "new", "r2"]);
	});

	it("inserts into a children container", () => {
		const child = makeRow("child");
		const container = makeRow("container", { children_row_ids: ["child"] });
		const newRow = makeRow("new");
		const page = makePage("p1", ["container"]);
		const maps = makeMaps([], [page], [container, child, newRow]);

		const next = insertIntoLocation(maps, "p1", "new", 0, {
			rowId: "container",
			type: "children",
		});
		expect(
			(next.rowsById.container?.data.children_row_ids as string[]) ?? [],
		).toEqual(["new", "child"]);
	});

	it("sets child_row_id on a child container", () => {
		const container = makeRow("container");
		const newRow = makeRow("new");
		const page = makePage("p1", ["container"]);
		const maps = makeMaps([], [page], [container, newRow]);

		const next = insertIntoLocation(maps, "p1", "new", 0, {
			rowId: "container",
			type: "child",
		});
		expect(next.rowsById.container?.data.child_row_id).toBe("new");
	});
});

// ---------------------------------------------------------------------------
// setFooterRow
// ---------------------------------------------------------------------------

describe("setFooterRow", () => {
	it("sets the footer row on a page", () => {
		const row = makeRow("footer");
		const page = makePage("p1", []);
		const maps = makeMaps([], [page], [row]);
		const next = setFooterRow(maps, "p1", "footer");
		expect(next.pagesById.p1?.footerRowId).toBe("footer");
	});
});

// ---------------------------------------------------------------------------
// removeRowFromPage
// ---------------------------------------------------------------------------

describe("removeRowFromPage", () => {
	it("removes a row from page rowIds and cleans up rowsById", () => {
		const row = makeRow("r1");
		const page = makePage("p1", ["r1"]);
		const maps = makeMaps([makeFlow("f1", ["p1"])], [page], [row]);
		const next = removeRowFromPage(maps, "p1", "r1");
		expect(next.pagesById.p1?.rowIds).toEqual([]);
		expect(next.rowsById.r1).toBeUndefined();
	});

	it("removes the footer row", () => {
		const footer = makeRow("footer");
		const page = makePage("p1", [], "footer");
		const maps = makeMaps([makeFlow("f1", ["p1"])], [page], [footer]);
		const next = removeRowFromPage(maps, "p1", "footer");
		expect(next.pagesById.p1?.footerRowId).toBeUndefined();
		expect(next.rowsById.footer).toBeUndefined();
	});

	it("removes a row from a children container", () => {
		const child = makeRow("child");
		const container = makeRow("container", { children_row_ids: ["child"] });
		const page = makePage("p1", ["container"]);
		const maps = makeMaps(
			[makeFlow("f1", ["p1"])],
			[page],
			[container, child],
		);
		const next = removeRowFromPage(maps, "p1", "child");
		expect(next.rowsById.container?.data.children_row_ids).toEqual([]);
		expect(next.rowsById.child).toBeUndefined();
	});

	it("removes descendants along with the target row", () => {
		const grandchild = makeRow("grandchild");
		const child = makeRow("child", { child_row_id: "grandchild" });
		const page = makePage("p1", ["child"]);
		const maps = makeMaps(
			[makeFlow("f1", ["p1"])],
			[page],
			[child, grandchild],
		);
		const next = removeRowFromPage(maps, "p1", "child");
		expect(next.rowsById.child).toBeUndefined();
		expect(next.rowsById.grandchild).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// moveRow
// ---------------------------------------------------------------------------

describe("moveRow", () => {
	it("moves a row between pages", () => {
		const row = makeRow("r1");
		const p1 = makePage("p1", ["r1"]);
		const p2 = makePage("p2", []);
		const maps = makeMaps([makeFlow("f1", ["p1", "p2"])], [p1, p2], [row]);
		const next = moveRow(maps, "r1", "p1", "p2", 0);
		expect(next.pagesById.p1?.rowIds).toEqual([]);
		expect(next.pagesById.p2?.rowIds).toEqual(["r1"]);
	});

	it("moves a row within the same page", () => {
		const r1 = makeRow("r1");
		const r2 = makeRow("r2");
		const page = makePage("p1", ["r1", "r2"]);
		const maps = makeMaps([makeFlow("f1", ["p1"])], [page], [r1, r2]);
		const next = moveRow(maps, "r1", "p1", "p1", 2);
		expect(next.pagesById.p1?.rowIds).toEqual(["r2", "r1"]);
	});
});

// ---------------------------------------------------------------------------
// moveRowToFooter
// ---------------------------------------------------------------------------

describe("moveRowToFooter", () => {
	it("moves a row from page rowIds to footer", () => {
		const row = makeRow("r1");
		const page = makePage("p1", ["r1"]);
		const maps = makeMaps([makeFlow("f1", ["p1"])], [page], [row]);
		const next = moveRowToFooter(maps, "r1", "p1", "p1");
		expect(next.pagesById.p1?.rowIds).toEqual([]);
		expect(next.pagesById.p1?.footerRowId).toBe("r1");
	});
});

// ---------------------------------------------------------------------------
// updateRowField
// ---------------------------------------------------------------------------

describe("updateRowField", () => {
	it("updates a data field", () => {
		const row = makeRow("r1", { title: "old" });
		const maps = makeMaps([], [], [row]);
		const next = updateRowField(maps, "r1", "title", "new");
		expect(next.rowsById.r1?.data.title).toBe("new");
	});

	it("updates visible as a top-level field", () => {
		const row = makeRow("r1");
		const maps = makeMaps([], [], [row]);
		const next = updateRowField(maps, "r1", "visible", "{count(x) > 0}");
		expect(next.rowsById.r1?.visible).toBe("{count(x) > 0}");
	});
});

// ---------------------------------------------------------------------------
// updateRowActions
// ---------------------------------------------------------------------------

describe("updateRowActions", () => {
	it("updates the actions array in data", () => {
		const row = makeRow("r1");
		const maps = makeMaps([], [], [row]);
		const actions = [{ condition: "", true: "{close()}", false: "" }];
		const next = updateRowActions(maps, "r1", { tap: actions });
		expect(next.rowsById.r1?.data.actions).toEqual({ tap: actions });
	});
});

// ---------------------------------------------------------------------------
// addPage / removePage
// ---------------------------------------------------------------------------

describe("addPage", () => {
	it("adds a page to the flow", () => {
		const flow = makeFlow("f1", ["p1"]);
		const p1 = makePage("p1", []);
		const newPage = makePage("p2", []);
		const maps = makeMaps([flow], [p1], []);
		const next = addPage(maps, "f1", newPage);
		expect(next.flowsById.f1?.pageIds).toEqual(["p1", "p2"]);
		expect(next.pagesById.p2).toBeDefined();
	});
});

describe("removePage", () => {
	it("removes a page and its rows from the maps", () => {
		const flow = makeFlow("f1", ["p1", "p2"]);
		const p1 = makePage("p1", ["r1"]);
		const p2 = makePage("p2", ["r2"]);
		const r1 = makeRow("r1");
		const r2 = makeRow("r2");
		const maps = makeMaps([flow], [p1, p2], [r1, r2]);
		const next = removePage(maps, "f1", "p2");
		expect(next.flowsById.f1?.pageIds).toEqual(["p1"]);
		expect(next.pagesById.p2).toBeUndefined();
		expect(next.rowsById.r2).toBeUndefined();
		expect(next.rowsById.r1).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// updatePageTitle
// ---------------------------------------------------------------------------

describe("updatePageTitle", () => {
	it("updates the page title", () => {
		const page = makePage("p1", []);
		const maps = makeMaps([], [page], []);
		const next = updatePageTitle(maps, "p1", "My Page");
		expect(next.pagesById.p1?.title).toBe("My Page");
	});
});

// ---------------------------------------------------------------------------
// addFlowRecords
// ---------------------------------------------------------------------------

describe("addFlowRecords", () => {
	it("adds flow, pages, and rows to the maps", () => {
		const flow = makeFlow("f1", ["p1"]);
		const page = makePage("p1", ["r1"]);
		const row = makeRow("r1");
		const maps = makeMaps([], [], []);
		const next = addFlowRecords(maps, flow, [page], [row]);
		expect(next.flowsById.f1).toBeDefined();
		expect(next.pagesById.p1).toBeDefined();
		expect(next.rowsById.r1).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// addRowRecords
// ---------------------------------------------------------------------------

describe("addRowRecords", () => {
	it("adds rows to rowsById", () => {
		const row = makeRow("r1");
		const maps = makeMaps([], [], []);
		const next = addRowRecords(maps, [row]);
		expect(next.rowsById.r1).toBe(row);
	});
});

// ---------------------------------------------------------------------------
// findPageContainingRow
// ---------------------------------------------------------------------------

describe("findPageContainingRow", () => {
	it("returns the page containing the row", () => {
		const flow = makeFlow("f1", ["p1", "p2"]);
		const p1 = makePage("p1", ["r1"]);
		const p2 = makePage("p2", ["r2"]);
		const r1 = makeRow("r1");
		const r2 = makeRow("r2");
		const maps = makeMaps([flow], [p1, p2], [r1, r2]);
		const result = findPageContainingRow(maps, "f1", "r2");
		expect(result?.id).toBe("p2");
	});
});

// ---------------------------------------------------------------------------
// findChildIndexInContainer
// ---------------------------------------------------------------------------

describe("findChildIndexInContainer", () => {
	it("finds the index of a child in a container", () => {
		const container = makeRow("c", {
			children_row_ids: ["a", "b", "target"],
		});
		const maps = makeMaps([], [], [container]);
		expect(findChildIndexInContainer(maps, "c", "target")).toBe(2);
	});

	it("returns -1 when not found", () => {
		const container = makeRow("c", { children_row_ids: ["a"] });
		const maps = makeMaps([], [], [container]);
		expect(findChildIndexInContainer(maps, "c", "missing")).toBe(-1);
	});
});

// ---------------------------------------------------------------------------
// pageRootIds
// ---------------------------------------------------------------------------

describe("pageRootIds", () => {
	it("returns rowIds only when no footer", () => {
		const page = makePage("p1", ["r1", "r2"]);
		expect(pageRootIds(page)).toEqual(["r1", "r2"]);
	});

	it("includes footerRowId when present", () => {
		const page = makePage("p1", ["r1"], "footer");
		expect(pageRootIds(page)).toEqual(["r1", "footer"]);
	});
});

// ---------------------------------------------------------------------------
// ensureShowAction
// ---------------------------------------------------------------------------

describe("ensureShowAction", () => {
	// New actions are written structured, so this asserts the invocation rather
	// than the legacy string.
	it("adds a structured show action when missing", () => {
		const row = makeRow("r1", { actions: {} });
		const maps = makeMaps([], [], [row]);
		const next = ensureShowAction(maps, "r1", "sheet-1");
		const actions = next.rowsById.r1?.data.actions as {
			tap?: { condition: string; true: unknown; false: unknown }[];
		};
		expect(
			actions.tap?.some(
				(a) =>
					JSON.stringify(a.true) ===
					JSON.stringify({ fn: "show", rowId: "sheet-1" }),
			),
		).toBe(true);
	});

	it("does not duplicate {show(sheetId)} action", () => {
		const showAction = {
			condition: "",
			true: "{show(sheet-1)}",
			false: "",
		};
		const row = makeRow("r1", { actions: { tap: [showAction] } });
		const maps = makeMaps([], [], [row]);
		const next = ensureShowAction(maps, "r1", "sheet-1");
		const actions = next.rowsById.r1?.data.actions as {
			tap?: (typeof showAction)[];
		};
		expect(
			actions.tap?.filter((a) => a.true === "{show(sheet-1)}").length,
		).toBe(1);
	});

	it("updates unconditional show when sheet is replaced", () => {
		const showAction = {
			condition: "",
			true: "{show(old-sheet)}",
			false: "",
		};
		const row = makeRow("r1", { actions: { tap: [showAction] } });
		const maps = makeMaps([], [], [row]);
		const next = ensureShowAction(maps, "r1", "new-sheet", "old-sheet");
		const actions = next.rowsById.r1?.data.actions as {
			tap?: { condition: string; true: unknown; false: unknown }[];
		};
		// A legacy show action is recognised and replaced with the structured form.
		expect(
			actions.tap?.some(
				(a) =>
					JSON.stringify(a.true) ===
					JSON.stringify({ fn: "show", rowId: "new-sheet" }),
			),
		).toBe(true);
		expect(actions.tap?.some((a) => a.true === "{show(old-sheet)}")).toBe(
			false,
		);
	});
});

describe("updateFlowSubmits", () => {
	const submits = { service: "svc-1", resource: "res-1" };

	function mapsWithFlow(): FlowEntityMaps {
		return {
			flowsById: { f1: makeFlow("f1", ["p1"]) },
			pagesById: {},
			rowsById: {},
		};
	}

	it("sets the declaration and stamps updatedAt", () => {
		const next = updateFlowSubmits(mapsWithFlow(), "f1", submits);

		expect(next.flowsById.f1?.submits).toEqual(submits);
		expect(next.flowsById.f1?.updatedAt).not.toBe(NOW);
	});

	it("removes the key entirely when cleared", () => {
		const withDeclaration = updateFlowSubmits(
			mapsWithFlow(),
			"f1",
			submits,
		);
		const cleared = updateFlowSubmits(withDeclaration, "f1", undefined);

		expect(cleared.flowsById.f1?.submits).toBeUndefined();
		expect("submits" in (cleared.flowsById.f1 ?? {})).toBe(false);
	});

	it("does not mutate the previous maps", () => {
		const maps = mapsWithFlow();
		const next = updateFlowSubmits(maps, "f1", submits);

		expect(maps.flowsById.f1?.submits).toBeUndefined();
		expect(next).not.toBe(maps);
	});

	it("is a no-op for an unknown flow", () => {
		const maps = mapsWithFlow();
		expect(updateFlowSubmits(maps, "missing", submits)).toBe(maps);
	});
});

describe("applyRemoteRecord", () => {
	function mapsWithRow(updatedAt: string): FlowEntityMaps {
		return {
			flowsById: {},
			pagesById: {},
			rowsById: {
				r1: { ...makeRow("r1", { text: "local" }), updatedAt },
			},
		};
	}

	it("applies a strictly newer record", () => {
		const next = applyRemoteRecord(
			mapsWithRow("2026-01-01T00:00:00.000Z"),
			"rows",
			{ id: "r1", updatedAt: "2026-02-01T00:00:00.000Z" },
			"update",
		);

		expect(next.rowsById.r1?.updatedAt).toBe("2026-02-01T00:00:00.000Z");
	});

	// The echo of our own write carries the timestamp we already hold.
	it("ignores a record that is not newer", () => {
		const maps = mapsWithRow("2026-02-01T00:00:00.000Z");
		const next = applyRemoteRecord(
			maps,
			"rows",
			{ id: "r1", updatedAt: "2026-02-01T00:00:00.000Z" },
			"update",
		);

		expect(next).toBe(maps);
	});

	it("ignores a record older than the local copy", () => {
		const maps = mapsWithRow("2026-03-01T00:00:00.000Z");
		const next = applyRemoteRecord(
			maps,
			"rows",
			{ id: "r1", updatedAt: "2026-01-01T00:00:00.000Z" },
			"update",
		);

		expect(next).toBe(maps);
	});

	it("removes a record on a delete push", () => {
		const next = applyRemoteRecord(
			mapsWithRow("2026-01-01T00:00:00.000Z"),
			"rows",
			{ id: "r1" },
			"delete",
		);

		expect(next.rowsById.r1).toBeUndefined();
	});

	it("removes a record carrying a tombstone", () => {
		const next = applyRemoteRecord(
			mapsWithRow("2026-01-01T00:00:00.000Z"),
			"rows",
			{ id: "r1", deletedAt: "2026-02-01T00:00:00.000Z" },
			"update",
		);

		expect(next.rowsById.r1).toBeUndefined();
	});

	it("adds a record the builder has not seen", () => {
		const next = applyRemoteRecord(
			mapsWithRow("2026-01-01T00:00:00.000Z"),
			"rows",
			{ id: "r2", updatedAt: "2026-02-01T00:00:00.000Z" },
			"create",
		);

		expect(next.rowsById.r2).toBeDefined();
	});

	it("ignores resources the builder does not hold", () => {
		const maps = mapsWithRow("2026-01-01T00:00:00.000Z");

		expect(
			applyRemoteRecord(maps, "messages", { id: "m1" }, "update"),
		).toBe(maps);
	});

	it("does not mutate the previous maps", () => {
		const maps = mapsWithRow("2026-01-01T00:00:00.000Z");
		applyRemoteRecord(
			maps,
			"rows",
			{ id: "r1", updatedAt: "2026-05-01T00:00:00.000Z" },
			"update",
		);

		expect(maps.rowsById.r1?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
	});
});
