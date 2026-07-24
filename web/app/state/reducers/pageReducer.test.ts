import { describe, expect, it, mock } from "bun:test";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";

import type { AppState } from "../../types/actions";
import type { Row, RowConfig } from "../../types/row";

function MockTextBase() {
	return null;
}
Object.defineProperty(MockTextBase, "name", { value: "TextRow" });
const mockTextWithConfig = MockTextBase as typeof MockTextBase & {
	config: Row["config"];
};
mockTextWithConfig.config = {
	type: "Text",
	visible: "true",
	actions: {},
	title: "",
	text: "",
} satisfies RowConfig;

mock.module("../../rows/baseRows", () => ({
	baseRows: [mockTextWithConfig],
}));

const { pageReducer } = await import("./pageReducer");

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
		title: "Page",
		rowIds,
		footerRowId,
		createdAt: NOW,
		updatedAt: NOW,
		visibility: "public",
	};
}

function makeTextRow(
	id: string,
	extra: Record<string, unknown> = {},
): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "Text",
		visible: "true",
		data: { title: "T", text: "hello", ...extra },
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function makeContainerRow(
	id: string,
	sheetRowId?: string,
	childrenRowIds: string[] = [],
): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "VerticalContainer",
		visible: "true",
		data: {
			title: "Container",
			...(sheetRowId ? { sheet_row_id: sheetRowId } : {}),
			...(childrenRowIds.length
				? { children_row_ids: childrenRowIds }
				: {}),
		},
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function makeSearchRow(
	id: string,
	extra: Record<string, unknown> = {},
): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "Search",
		visible: "true",
		data: {
			source: "{$api:place_search}",
			destination: "{pickup_address}",
			...extra,
		},
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function makeButtonRow(
	id: string,
	extra: Record<string, unknown> = {},
): DATA_EVY_Row {
	return {
		id,
		name: id,
		type: "Button",
		visible: "true",
		data: {
			label: "Go",
			actions: {},
			...extra,
		},
		visibility: "public",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

function initialState(overrides: Partial<AppState> = {}): AppState {
	const row1 = makeTextRow("row-1");
	const row2 = makeTextRow("row-2");
	const p1 = makePage("page-1", ["row-1"]);
	const p2 = makePage("page-2", ["row-2"]);
	const flow = makeFlow("flow-1", ["page-1", "page-2"]);

	return {
		flowsById: { "flow-1": flow },
		pagesById: { "page-1": p1, "page-2": p2 },
		rowsById: { "row-1": row1, "row-2": row2 },
		activeFlowId: "flow-1",
		activePageId: "page-1",
		configStack: [],
		...overrides,
	};
}

describe("pageReducer", () => {
	it("SET_ACTIVE_FLOW clears row and config stack", () => {
		const state = initialState({
			activeRowId: "row-1",
			configStack: ["some-id"],
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_FLOW",
			flowId: "flow-1",
		});
		expect(next.activeRowId).toBeUndefined();
		expect(next.configStack).toEqual([]);
	});

	it("CREATE_FLOW ignores empty name", () => {
		const state = initialState();
		const next = pageReducer(state, { type: "CREATE_FLOW", name: "  " });
		expect(next).toBe(state);
	});

	it("CREATE_FLOW appends flow and selects it", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "CREATE_FLOW",
			name: "New Flow",
		});
		const newFlowId = next.activeFlowId;
		const newFlow = newFlowId ? next.flowsById[newFlowId] : undefined;
		expect(newFlowId).not.toBe("flow-1");
		expect(newFlow?.name).toBe("New Flow");
		expect(next.activePageId).toBeDefined();
		expect(next.configStack).toEqual([]);
	});

	it("ADD_PAGE appends page to active flow", () => {
		const state = initialState();
		const next = pageReducer(state, { type: "ADD_PAGE" });
		const flow = next.flowsById["flow-1"];
		expect(flow?.pageIds).toHaveLength(3);
		expect(next.activePageId).toBe(flow?.pageIds[2]);
	});

	it("ADD_ROW inserts TextRow from palette", () => {
		const state = initialState();
		const newId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
		});
		const page = next.pagesById["page-1"];
		expect(page?.rowIds[0]).toBe(newId);
		expect(next.rowsById[newId]).toBeDefined();
		expect(next.activeRowId).toBe(newId);
	});

	it("UPDATE_ROW sets config content field", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "row-1",
			configId: "title",
			configValue: "Updated",
		});
		expect(next.rowsById["row-1"]?.data.title).toBe("Updated");
	});

	it("UPDATE_ROW keeps comma-containing string fields as strings", () => {
		const row = makeTextRow("r", { title: "Some, title" });
		const state = initialState({
			rowsById: { r: row },
			pagesById: {
				"page-1": makePage("page-1", ["r"]),
				"page-2": makePage("page-2", []),
			},
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "r",
			configId: "title",
			configValue: "Hello, World",
		});
		expect(next.rowsById.r?.data.title).toBe("Hello, World");
	});

	it("UPDATE_ROW splits comma-separated values for array content fields (segments)", () => {
		const row: DATA_EVY_Row = {
			...makeTextRow("r"),
			type: "TabContainer",
			data: { segments: ["A", "B"] },
		};
		const state = initialState({
			rowsById: { r: row },
			pagesById: {
				"page-1": makePage("page-1", ["r"]),
				"page-2": makePage("page-2", []),
			},
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "r",
			configId: "segments",
			configValue: "X, Y, Z",
		});
		expect(next.rowsById.r?.data.segments).toEqual(["X", "Y", "Z"]);
	});

	it("UPDATE_ROW_ROOT sets source without changing other fields", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ROOT",
			rowId: "row-1",
			field: "source",
			value: "{items}",
		});
		expect(next.rowsById["row-1"]?.data.source).toBe("{items}");
		expect(next.rowsById["row-1"]?.data.title).toBe("T");
	});

	it("UPDATE_ROW_ROOT sets destination to empty string when value is empty string", () => {
		const row = makeTextRow("r", { destination: "{old}" });
		const state = initialState({
			rowsById: { r: row },
			pagesById: {
				"page-1": makePage("page-1", ["r"]),
				"page-2": makePage("page-2", []),
			},
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ROOT",
			rowId: "r",
			field: "destination",
			value: "",
		});
		expect(next.rowsById.r?.data.destination).toBe("");
	});

	it("SET_ACTIVE_ROW updates selection", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "row-1",
		});
		expect(next.activeRowId).toBe("row-1");
		expect(next.activePageId).toBe("page-1");
		expect(next.configStack).toEqual([]);
	});

	it("SET_ACTIVE_ROW derives root and config stack for nested row", () => {
		const inner = makeTextRow("inner");
		const list = makeContainerRow("list", undefined, ["inner"]);
		const state = initialState({
			rowsById: { list, inner },
			pagesById: {
				"page-1": makePage("page-1", ["list"]),
				"page-2": makePage("page-2", []),
			},
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "inner",
		});
		expect(next.activeRowId).toBe("list");
		expect(next.configStack).toEqual(["inner"]);
	});

	it("SET_ACTIVE_ROW respects explicit configStack for URL restore", () => {
		const inner = makeTextRow("inner");
		const list = makeContainerRow("list", undefined, ["inner"]);
		const state = initialState({
			rowsById: { list, inner },
			pagesById: {
				"page-1": makePage("page-1", ["list"]),
				"page-2": makePage("page-2", []),
			},
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "list",
			configStack: ["inner"],
		});
		expect(next.activeRowId).toBe("list");
		expect(next.configStack).toEqual(["inner"]);
	});

	it("SET_ACTIVE_PAGE clears row selection", () => {
		const state = initialState({ activeRowId: "row-1" });
		const next = pageReducer(state, {
			type: "SET_ACTIVE_PAGE",
			pageId: "page-1",
		});
		expect(next.activeRowId).toBeUndefined();
		expect(next.activePageId).toBe("page-1");
	});

	it("CLEAR_ACTIVE_SELECTION resets selection", () => {
		const state = initialState({
			activeRowId: "row-1",
			activePageId: "page-1",
			configStack: ["child"],
		});
		const next = pageReducer(state, { type: "CLEAR_ACTIVE_SELECTION" });
		expect(next.activeRowId).toBeUndefined();
		expect(next.activePageId).toBeUndefined();
		expect(next.configStack).toEqual([]);
	});

	it("REMOVE_PAGE keeps at least one page", () => {
		const flow = makeFlow("flow-1", ["page-1"]);
		const state = initialState({
			flowsById: { "flow-1": flow },
			pagesById: { "page-1": makePage("page-1", []) },
			rowsById: {},
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "REMOVE_PAGE",
			pageId: "page-1",
		});
		expect(next).toBe(state);
	});

	it("REMOVE_PAGE keeps other flows' rows in the store", () => {
		const otherFlow = makeFlow("flow-2", ["page-3"]);
		const otherPage = makePage("page-3", ["row-3"]);
		const otherRow = makeTextRow("row-3");
		const base = initialState();
		const state = initialState({
			flowsById: { ...base.flowsById, "flow-2": otherFlow },
			pagesById: { ...base.pagesById, "page-3": otherPage },
			rowsById: { ...base.rowsById, "row-3": otherRow },
		});
		const next = pageReducer(state, {
			type: "REMOVE_PAGE",
			pageId: "page-2",
		});
		expect(next.rowsById["row-3"]).toBeDefined();
		expect(next.rowsById["row-2"]).toBeUndefined();
	});

	it("REMOVE_PAGE selects another page when active removed", () => {
		const state = initialState({ activePageId: "page-2" });
		const next = pageReducer(state, {
			type: "REMOVE_PAGE",
			pageId: "page-2",
		});
		expect(next.flowsById["flow-1"]?.pageIds).not.toContain("page-2");
		expect(next.activePageId).toBe("page-1");
	});

	it("UPDATE_PAGE_TITLE updates page title", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_PAGE_TITLE",
			pageId: "page-1",
			title: "My Page",
		});
		expect(next.pagesById["page-1"]?.title).toBe("My Page");
	});

	it("MOVE_ROW moves row between pages", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "MOVE_ROW",
			rowId: "row-1",
			originPageId: "page-1",
			destinationPageId: "page-2",
			destinationIndex: 0,
		});
		expect(next.pagesById["page-1"]?.rowIds).not.toContain("row-1");
		expect(next.pagesById["page-2"]?.rowIds).toContain("row-1");
	});

	it("REMOVE_ROW removes row from page", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "row-1",
		});
		expect(next.pagesById["page-1"]?.rowIds).not.toContain("row-1");
		expect(next.rowsById["row-1"]).toBeUndefined();
	});

	it("UPDATE_ROW_ACTIONS sets actions", () => {
		const state = initialState();
		const actions = {
			tap: [{ condition: "", true: "{close()}", false: "" }],
		};
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ACTIONS",
			rowId: "row-1",
			actions,
		});
		expect(next.rowsById["row-1"]?.data.actions).toEqual(actions);
	});

	it("SET_ACTIVE_PAGE toggles off when same page is already active with no row", () => {
		const state = initialState({
			activePageId: "page-1",
			activeRowId: undefined,
			configStack: [],
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_PAGE",
			pageId: "page-1",
		});
		expect(next.activePageId).toBeUndefined();
		expect(next.activeRowId).toBeUndefined();
	});

	it("SET_ACTIVE_ROW toggles off when same row chain is already active", () => {
		const state = initialState({
			activeRowId: "row-1",
			activePageId: "page-1",
			configStack: [],
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "row-1",
		});
		expect(next.activeRowId).toBeUndefined();
	});

	it("PUSH_CONFIG_STACK and NAVIGATE_BREADCRUMB", () => {
		const state = initialState({ configStack: ["a"] });
		const pushed = pageReducer(state, {
			type: "PUSH_CONFIG_STACK",
			parentRowId: "row-1",
			childRowId: "b",
		});
		expect(pushed.configStack).toEqual(["a", "b"]);

		const popped = pageReducer(pushed, {
			type: "NAVIGATE_BREADCRUMB",
			configStackLength: 1,
		});
		expect(popped.configStack).toEqual(["a"]);
	});

	it("REMOVE_ROW removes footer root", () => {
		const foot = makeTextRow("foot");
		const state = initialState({
			rowsById: {
				foot,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", [], "foot"),
				"page-2": makePage("page-2", ["row-2"]),
			},
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "foot",
		});
		expect(next.pagesById["page-1"]?.footerRowId).toBeUndefined();
		expect(next.rowsById.foot).toBeUndefined();
	});

	it("REMOVE_ROW removes nested footer sheet", () => {
		const inner = makeTextRow("inner");
		const foot = makeContainerRow("foot", "inner");
		const state = initialState({
			rowsById: {
				foot,
				inner,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", [], "foot"),
				"page-2": makePage("page-2", ["row-2"]),
			},
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "inner",
		});
		expect(next.rowsById.foot?.data.sheet_row_id).toBeUndefined();
		expect(next.rowsById.inner).toBeUndefined();
	});

	it("MOVE_ROW moves footer root into page rows", () => {
		const foot = makeTextRow("foot");
		const state = initialState({
			rowsById: {
				foot,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", [], "foot"),
				"page-2": makePage("page-2", ["row-2"]),
			},
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "MOVE_ROW",
			rowId: "foot",
			originPageId: "page-1",
			destinationPageId: "page-1",
			destinationIndex: 0,
		});
		expect(next.pagesById["page-1"]?.footerRowId).toBeUndefined();
		expect(next.pagesById["page-1"]?.rowIds).toContain("foot");
	});

	it("ADD_ROW inserts palette row into child container", () => {
		const container = makeContainerRow("container");
		const state = initialState({
			rowsById: {
				container,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", ["container"]),
				"page-2": makePage("page-2", ["row-2"]),
			},
		});
		const newId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "container", type: "children" },
		});
		expect(
			next.rowsById.container?.data.children_row_ids as string[],
		).toContain(newId);
	});

	it("ADD_ROW inserts palette row into footer container", () => {
		const foot = makeContainerRow("foot");
		const state = initialState({
			rowsById: {
				foot,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", [], "foot"),
				"page-2": makePage("page-2", ["row-2"]),
			},
		});
		const newId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "foot", type: "children" },
		});
		expect(next.rowsById.foot?.data.children_row_ids as string[]).toContain(
			newId,
		);
	});

	it("ADD_ROW_AS_FOOTER adds palette row as page footer", () => {
		const state = initialState({
			pagesById: {
				"page-1": makePage("page-1", []),
				"page-2": makePage("page-2", ["row-2"]),
			},
			rowsById: { "row-2": makeTextRow("row-2") },
			activePageId: "page-1",
		});
		const newId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW_AS_FOOTER",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
		});
		expect(next.pagesById["page-1"]?.footerRowId).toBe(newId);
		expect(next.rowsById[newId]).toBeDefined();
	});

	it("ADD_ROW_AS_FOOTER no-ops when base row not found", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "ADD_ROW_AS_FOOTER",
			newRowId: crypto.randomUUID(),
			oldRowId: "NonExistentRow",
			destinationPageId: "page-1",
		});
		expect(next).toBe(state);
	});

	it("MOVE_ROW_TO_FOOTER moves row from page rows to footer", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "MOVE_ROW_TO_FOOTER",
			rowId: "row-1",
			originPageId: "page-1",
			destinationPageId: "page-1",
		});
		expect(next.pagesById["page-1"]?.rowIds).not.toContain("row-1");
		expect(next.pagesById["page-1"]?.footerRowId).toBe("row-1");
	});

	it("MOVE_ROW_TO_FOOTER moves row across pages", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "MOVE_ROW_TO_FOOTER",
			rowId: "row-1",
			originPageId: "page-1",
			destinationPageId: "page-2",
		});
		expect(next.pagesById["page-1"]?.rowIds).not.toContain("row-1");
		expect(next.pagesById["page-2"]?.footerRowId).toBe("row-1");
	});

	it("ADD_ROW inserts palette row as sheet of footer descendant (blank sheet page drop)", () => {
		const footerParent = makeContainerRow("footer-parent");
		const footerRoot = makeContainerRow("footer-root", "footer-parent");
		const state = initialState({
			rowsById: {
				"footer-root": footerRoot,
				"footer-parent": footerParent,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", [], "footer-root"),
				"page-2": makePage("page-2", ["row-2"]),
			},
		});
		const newId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "footer-parent", type: "sheet" },
		});
		expect(next.rowsById["footer-parent"]?.data.sheet_row_id).toBe(newId);
		expect(next.rowsById["footer-parent"]?.data.actions).toEqual({
			tap: [{ condition: "", true: `{show(${newId})}`, false: "" }],
		});
	});

	it("ADD_ROW writes Search child independently of an existing sheet", () => {
		const search = makeSearchRow("search", {
			sheet_row_id: "existing-sheet",
			actions: {
				tap: [
					{
						condition: "",
						true: "{show(existing-sheet)}",
						false: "",
					},
				],
			},
		});
		const existingSheet = makeTextRow("existing-sheet");
		const state = initialState({
			rowsById: {
				search,
				"existing-sheet": existingSheet,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", ["search"]),
				"page-2": makePage("page-2", ["row-2"]),
			},
		});
		const childId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: childId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "search", type: "child" },
		});
		expect(next.rowsById.search?.data.child_row_id).toBe(childId);
		expect(next.rowsById.search?.data.sheet_row_id).toBe("existing-sheet");
		expect(next.rowsById.search?.data.actions).toEqual({
			tap: [
				{
					condition: "",
					true: "{show(existing-sheet)}",
					false: "",
				},
			],
		});
	});

	it("ADD_ROW replaces a sheet and updates only the default show action", () => {
		const button = makeButtonRow("button", {
			sheet_row_id: "old-sheet",
			actions: {
				tap: [
					{ condition: "", true: "{show(old-sheet)}", false: "" },
					{
						condition: "other",
						true: "{show(other-page-row)}",
						false: "",
					},
				],
			},
		});
		const oldSheet = makeTextRow("old-sheet");
		const state = initialState({
			rowsById: {
				button,
				"old-sheet": oldSheet,
				"row-1": makeTextRow("row-1"),
				"row-2": makeTextRow("row-2"),
			},
			pagesById: {
				"page-1": makePage("page-1", ["button"]),
				"page-2": makePage("page-2", ["row-2"]),
			},
		});
		const newSheetId = crypto.randomUUID();
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newSheetId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "button", type: "sheet" },
		});
		expect(next.rowsById.button?.data.sheet_row_id).toBe(newSheetId);
		expect(next.rowsById.button?.data.actions).toEqual({
			tap: [
				{ condition: "", true: `{show(${newSheetId})}`, false: "" },
				{
					condition: "other",
					true: "{show(other-page-row)}",
					false: "",
				},
			],
		});
	});
});
