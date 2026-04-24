import { describe, expect, it, mock } from "bun:test";

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
	source: "",
	actions: [],
	view: {
		content: { title: "", text: "" },
		max_lines: "",
	},
} as Row["config"];

mock.module("../../rows/baseRows", () => ({
	baseRows: [mockTextWithConfig],
}));

const { pageReducer } = await import("./pageReducer");

function textRow(id: string, text = "hello"): Row {
	return {
		id,
		row: null,
		config: {
			type: "Text",
			source: "",
			actions: [],
			view: {
				content: { title: "T", text },
				max_lines: "",
			},
		} as Row["config"],
	};
}

function sheetRow(id: string, child: Row, children: Row[] = []): Row {
	return {
		id,
		row: null,
		config: {
			type: "SheetContainer",
			source: "",
			actions: [],
			view: {
				content: {
					title: "Sheet",
					child,
					children,
				},
			},
		} as Row["config"],
	};
}

function initialState(overrides: Partial<AppState> = {}): AppState {
	return {
		flows: [
			{
				id: "flow-1",
				name: "Flow",
				pages: [
					{
						id: "page-1",
						title: "Page",
						rows: [textRow("row-1")],
					},
					{
						id: "page-2",
						title: "Second",
						rows: [textRow("row-2")],
					},
				],
			},
		],
		activeFlowId: "flow-1",
		activePageId: "page-1",
		focusMode: false,
		configStack: [],
		...overrides,
	};
}

describe("pageReducer", () => {
	it("SET_ACTIVE_FLOW clears row and config stack", () => {
		const state = initialState({ activeRowId: "row-1", configStack: ["x"] });
		const next = pageReducer(state, {
			type: "SET_ACTIVE_FLOW",
			flowId: "flow-1",
		});
		expect(next.activeFlowId).toBe("flow-1");
		expect(next.activeRowId).toBeUndefined();
		expect(next.configStack).toEqual([]);
	});

	it("CREATE_FLOW ignores empty name", () => {
		const state = initialState();
		const next = pageReducer(state, { type: "CREATE_FLOW", name: "   " });
		expect(next.flows.length).toBe(state.flows.length);
	});

	it("CREATE_FLOW appends flow and selects it", () => {
		const state = initialState();
		const next = pageReducer(state, { type: "CREATE_FLOW", name: "New Flow" });
		expect(next.flows.length).toBe(2);
		expect(next.activeFlowId).toBe(next.flows[1].id);
		expect(next.flows[1].name).toBe("New Flow");
		expect(next.activePageId).toBe(next.flows[1].pages[0]?.id);
	});

	it("ADD_PAGE appends page to active flow", () => {
		const state = initialState();
		const next = pageReducer(state, { type: "ADD_PAGE" });
		expect(next.flows[0].pages.length).toBe(3);
		expect(next.activePageId).toBe(next.flows[0].pages[2]?.id);
	});

	it("ADD_ROW inserts TextRow from palette", () => {
		const state = initialState();
		const newId = "new-text-id";
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
		});
		expect(next.flows[0].pages[0].rows[0].id).toBe(newId);
		expect(next.activeRowId).toBe(newId);
	});

	it("UPDATE_ROW sets config content field", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "row-1",
			configId: "text",
			configValue: "updated",
		});
		const row = next.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		expect(row?.config.view.content.text).toBe("updated");
	});

	it("UPDATE_ROW splits comma-separated value into array", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "row-1",
			configId: "text",
			configValue: "a,b",
		});
		const row = next.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		expect(row?.config.view.content.text).toEqual(["a", "b"]);
	});

	it("UPDATE_ROW_ROOT sets source without changing view.content", () => {
		const state = initialState();
		const before = state.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ROOT",
			rowId: "row-1",
			field: "source",
			value: "{items}",
		});
		const row = next.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		expect(row?.config.source).toBe("{items}");
		expect(row?.config.view.content).toEqual(before?.config.view.content);
	});

	it("UPDATE_ROW_ROOT sets destination to empty string when value is empty string", () => {
		const base = textRow("row-1");
		const rowWithDestination: Row = {
			...base,
			config: {
				...base.config,
				destination: "{title}",
			} satisfies RowConfig,
		};
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [rowWithDestination],
						},
					],
				},
			],
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ROOT",
			rowId: "row-1",
			field: "destination",
			value: "",
		});
		const row = next.flows[0].pages[0].rows[0];
		expect(row.config.destination).toBe("");
	});

	it("SET_ACTIVE_ROW updates selection", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "row-1",
		});
		expect(next.activeRowId).toBe("row-1");
		expect(next.activePageId).toBe("page-1");
	});

	it("SET_ACTIVE_ROW derives root and config stack for nested row", () => {
		const inner = textRow("inner");
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
						children: [inner],
					},
				},
			} as Row["config"],
		};
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [list],
						},
					],
				},
			],
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "inner",
		});
		expect(next.activeRowId).toBe("list-1");
		expect(next.configStack).toEqual(["inner"]);
		expect(next.activePageId).toBe("page-1");
	});

	it("SET_ACTIVE_ROW respects explicit configStack for URL restore", () => {
		const inner = textRow("inner");
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
						children: [inner],
					},
				},
			} as Row["config"],
		};
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [list],
						},
					],
				},
			],
		});
		const next = pageReducer(state, {
			type: "SET_ACTIVE_ROW",
			rowId: "list-1",
			configStack: ["inner"],
		});
		expect(next.activeRowId).toBe("list-1");
		expect(next.configStack).toEqual(["inner"]);
	});

	it("SET_ACTIVE_PAGE clears row selection", () => {
		const state = initialState({ activeRowId: "row-1" });
		const next = pageReducer(state, {
			type: "SET_ACTIVE_PAGE",
			pageId: "page-2",
		});
		expect(next.activePageId).toBe("page-2");
		expect(next.activeRowId).toBeUndefined();
	});

	it("CLEAR_ACTIVE_SELECTION resets selection and focus", () => {
		const state = initialState({
			activeRowId: "row-1",
			activePageId: "page-1",
			focusMode: true,
			secondarySheetRowId: "s",
			configStack: ["a"],
		});
		const next = pageReducer(state, { type: "CLEAR_ACTIVE_SELECTION" });
		expect(next.activeRowId).toBeUndefined();
		expect(next.activePageId).toBeUndefined();
		expect(next.focusMode).toBe(false);
		expect(next.secondarySheetRowId).toBeUndefined();
		expect(next.configStack).toEqual([]);
	});

	it("REMOVE_PAGE keeps at least one page", () => {
		const singlePageState: AppState = {
			...initialState(),
			flows: [
				{
					id: "flow-1",
					name: "F",
					pages: [{ id: "only", title: "P", rows: [] }],
				},
			],
			activePageId: "only",
		};
		const next = pageReducer(singlePageState, {
			type: "REMOVE_PAGE",
			pageId: "only",
		});
		expect(next.flows[0].pages.length).toBe(1);
	});

	it("REMOVE_PAGE selects another page when active removed", () => {
		const state = initialState({ activePageId: "page-1" });
		const next = pageReducer(state, { type: "REMOVE_PAGE", pageId: "page-1" });
		expect(next.flows[0].pages.length).toBe(1);
		expect(next.activePageId).toBe("page-2");
		expect(next.activeRowId).toBeUndefined();
	});

	it("UPDATE_PAGE_TITLE", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "UPDATE_PAGE_TITLE",
			pageId: "page-1",
			title: "Renamed",
		});
		expect(next.flows[0].pages[0].title).toBe("Renamed");
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
		expect(next.flows[0].pages[0].rows.some((r) => r.id === "row-1")).toBe(
			false,
		);
		expect(next.flows[0].pages[1].rows.some((r) => r.id === "row-1")).toBe(
			true,
		);
	});

	it("REMOVE_ROW removes row from page", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "row-1",
		});
		expect(next.flows[0].pages[0].rows.length).toBe(0);
	});

	it("UPDATE_ROW_ACTIONS sets actions", () => {
		const state = initialState();
		const actions = [{ condition: "", true: "close", false: "" }];
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ACTIONS",
			rowId: "row-1",
			actions,
		});
		const row = next.flows[0].pages[0].rows[0];
		expect(row.config.actions).toEqual(actions);
	});

	it("TOGGLE_FOCUS_MODE", () => {
		const state = initialState({ focusMode: false, activePageId: undefined });
		const on = pageReducer(state, { type: "TOGGLE_FOCUS_MODE" });
		expect(on.focusMode).toBe(true);
		expect(on.activePageId).toBe("page-1");
		const off = pageReducer(on, { type: "TOGGLE_FOCUS_MODE" });
		expect(off.focusMode).toBe(false);
	});

	it("PUSH_CONFIG_STACK and NAVIGATE_BREADCRUMB", () => {
		const state = initialState({ configStack: [] });
		const pushed = pageReducer(state, {
			type: "PUSH_CONFIG_STACK",
			parentRowId: "row-1",
			childRowId: "row-2",
		});
		expect(pushed.configStack.length).toBeGreaterThan(0);
		const popped = pageReducer(pushed, {
			type: "NAVIGATE_BREADCRUMB",
			configStackLength: 0,
		});
		expect(popped.configStack).toEqual([]);
	});

	it("PUSH_CONFIG_STACK auto-enters focus mode for SheetContainer child", () => {
		const state = initialState({
			activePageId: undefined,
			focusMode: false,
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [
								sheetRow("sheet-1", textRow("sheet-child"), [
									textRow("sheet-list-child"),
								]),
							],
						},
					],
				},
			],
		});

		const next = pageReducer(state, {
			type: "PUSH_CONFIG_STACK",
			parentRowId: "sheet-1",
			childRowId: "sheet-child",
		});

		expect(next.focusMode).toBe(true);
		expect(next.activePageId).toBe("page-1");
		expect(next.secondarySheetRowId).toBe("sheet-1");
		expect(next.configStack).toEqual(["sheet-child"]);
	});

	it("OPEN_SECONDARY_SHEET and CLOSE_SECONDARY_SHEET", () => {
		const state = initialState();
		const open = pageReducer(state, {
			type: "OPEN_SECONDARY_SHEET",
			sheetRowId: "sheet-1",
		});
		expect(open.secondarySheetRowId).toBe("sheet-1");
		const closed = pageReducer(open, { type: "CLOSE_SECONDARY_SHEET" });
		expect(closed.secondarySheetRowId).toBeUndefined();
		expect(closed.configStack).toEqual([]);
	});
});
