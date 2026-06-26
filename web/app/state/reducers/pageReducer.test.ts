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
	visible: "true",
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
			visible: "true",
			actions: [],
			view: {
				content: { title: "T", text },
				max_lines: "",
			},
		} as Row["config"],
	};
}

function containerRow(id: string, child: Row, children: Row[] = []): Row {
	return {
		id,
		row: null,
		config: {
			type: "ListContainer",
			source: "",
			visible: "true",
			actions: [],
			view: {
				content: {
					title: "Container",
					child,
					children,
				},
			},
		} as Row["config"],
	};
}

function calendarRow(id: string): Row {
	return {
		id,
		row: null,
		config: {
			type: "Calendar",
			source: "{delivery_selection}",
			destination: "{pickup_selection}",
			visible: "true",
			actions: [],
			view: {
				content: {
					title: "Calendar",
					start_time: "07:00",
					end_time: "19:00",
					timeslot_interval_minutes: 30,
					label_interval_minutes: 60,
					header_format: "EEE d",
					timeslot_format: "HH:mm",
				},
			},
		} as Row["config"],
	};
}

function selectSegmentRow(id: string): Row {
	return {
		id,
		row: null,
		config: {
			type: "SelectSegmentContainer",
			source: "",
			visible: "true",
			actions: [],
			view: {
				content: {
					title: "Segments",
					segments: ["X", "Y", "Z"],
					children: [],
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
		configStack: [],
		...overrides,
	};
}

describe("pageReducer", () => {
	it("SET_ACTIVE_FLOW clears row and config stack", () => {
		const state = initialState({
			activeRowId: "row-1",
			configStack: ["x"],
		});
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
		const next = pageReducer(state, {
			type: "CREATE_FLOW",
			name: "New Flow",
		});
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

	it("UPDATE_ROW keeps comma-containing string fields as strings", () => {
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [calendarRow("row-1")],
						},
					],
				},
			],
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "row-1",
			configId: "header_format",
			configValue: "EEE d, HH:mm",
		});
		const row = next.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		expect(row?.config.view.content.header_format).toBe("EEE d, HH:mm");
	});

	it("Calendar fixture uses row-level selection bindings", () => {
		const row = calendarRow("row-1");
		expect(row.config.source).toBe("{delivery_selection}");
		expect(row.config.destination).toBe("{pickup_selection}");
		expect(row.config.view.content.header_format).toBe("EEE d");
		expect(row.config.view.content.timeslot_format).toBe("HH:mm");
		expect(row.config.view.content).not.toHaveProperty("primary");
		expect(row.config.view.content).not.toHaveProperty("secondary");
		expect(row.config.view.content).not.toHaveProperty(
			"secondary_timeslots",
		);
	});

	it("UPDATE_ROW splits comma-separated values for array content fields", () => {
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [selectSegmentRow("row-1")],
						},
					],
				},
			],
		});
		const next = pageReducer(state, {
			type: "UPDATE_ROW",
			rowId: "row-1",
			configId: "segments",
			configValue: "One, Two, Three",
		});
		const row = next.flows[0].pages[0].rows.find((r) => r.id === "row-1");
		expect(row?.config.view.content.segments).toEqual([
			"One",
			"Two",
			"Three",
		]);
	});

	it("UPDATE_ROW_ROOT sets source without changing view.content", () => {
		const state = initialState();
		const before = state.flows[0].pages[0].rows.find(
			(r) => r.id === "row-1",
		);
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
				visible: "true",
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
				visible: "true",
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

	it("CLEAR_ACTIVE_SELECTION resets selection", () => {
		const state = initialState({
			activeRowId: "row-1",
			activePageId: "page-1",
			configStack: ["a"],
		});
		const next = pageReducer(state, { type: "CLEAR_ACTIVE_SELECTION" });
		expect(next.activeRowId).toBeUndefined();
		expect(next.activePageId).toBeUndefined();
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
		const next = pageReducer(state, {
			type: "REMOVE_PAGE",
			pageId: "page-1",
		});
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
		const actions = [{ condition: "", true: "{close()}", false: "" }];
		const next = pageReducer(state, {
			type: "UPDATE_ROW_ACTIONS",
			rowId: "row-1",
			actions,
		});
		const row = next.flows[0].pages[0].rows[0];
		expect(row.config.actions).toEqual(actions);
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
		expect(next.activePageId).toBeUndefined();
		expect(next.configStack).toEqual([]);
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

	it("REMOVE_ROW removes footer root", () => {
		const foot = textRow("footer-row");
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [textRow("row-1")],
							footer: foot,
						},
					],
				},
			],
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "footer-row",
		});
		expect(next.flows[0].pages[0].footer).toBeUndefined();
		expect(next.flows[0].pages[0].rows.length).toBe(1);
	});

	it("REMOVE_ROW removes nested footer child", () => {
		const inner = textRow("foot-inner");
		const foot = containerRow("footer-row", inner);
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [],
							footer: foot,
						},
					],
				},
			],
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "REMOVE_ROW",
			pageId: "page-1",
			rowId: "foot-inner",
		});
		expect(
			next.flows[0].pages[0].footer?.config.view.content.child,
		).toBeUndefined();
		expect(next.flows[0].pages[0].rows.length).toBe(0);
	});

	it("MOVE_ROW moves footer root into page rows", () => {
		const foot = textRow("footer-row");
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [textRow("row-1")],
							footer: foot,
						},
					],
				},
			],
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "MOVE_ROW",
			rowId: "footer-row",
			originPageId: "page-1",
			destinationPageId: "page-1",
			destinationIndex: 0,
		});
		expect(next.flows[0].pages[0].footer).toBeUndefined();
		expect(next.flows[0].pages[0].rows[0].id).toBe("footer-row");
		expect(next.flows[0].pages[0].rows[1].id).toBe("row-1");
	});

	it("ADD_ROW inserts palette row into child container", () => {
		const container = containerRow("parent", textRow("dummy"));
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [container],
						},
					],
				},
			],
		});
		const newId = "new-child";
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "parent", type: "child" },
		});
		const parentAfter = next.flows[0].pages[0].rows.find(
			(r) => r.id === "parent",
		);
		expect(parentAfter?.config.view.content.child?.id).toBe(newId);
	});

	it("ADD_ROW inserts palette row into footer container", () => {
		const foot = containerRow("footer-sheet", textRow("dummy"), []);
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [],
							footer: foot,
						},
					],
				},
			],
		});
		const newId = "new-in-footer";
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "footer-sheet", type: "children" },
		});
		const footAfter = next.flows[0].pages[0].footer;
		expect(footAfter?.config.view.content.children?.[0].id).toBe(newId);
	});

	it("ADD_ROW_AS_FOOTER adds palette row as page footer", () => {
		const state = initialState({
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
					],
				},
			],
			activePageId: "page-1",
		});
		const newId = "new-footer";
		const next = pageReducer(state, {
			type: "ADD_ROW_AS_FOOTER",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
		});
		expect(next.flows[0].pages[0].footer).toBeDefined();
		expect(next.flows[0].pages[0].footer?.id).toBe(newId);
		expect(next.flows[0].pages[0].rows.length).toBe(1);
		expect(next.activeRowId).toBe(newId);
	});

	it("ADD_ROW_AS_FOOTER no-ops when base row not found", () => {
		const state = initialState();
		const next = pageReducer(state, {
			type: "ADD_ROW_AS_FOOTER",
			newRowId: "new-footer",
			oldRowId: "NonExistentRow",
			destinationPageId: "page-1",
		});
		expect(next).toBe(state);
	});

	it("MOVE_ROW_TO_FOOTER moves row from page rows to footer", () => {
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [textRow("row-1"), textRow("row-2")],
						},
					],
				},
			],
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "MOVE_ROW_TO_FOOTER",
			rowId: "row-2",
			originPageId: "page-1",
			destinationPageId: "page-1",
		});
		expect(next.flows[0].pages[0].footer).toBeDefined();
		expect(next.flows[0].pages[0].footer?.id).toBe("row-2");
		expect(next.flows[0].pages[0].rows.length).toBe(1);
		expect(next.flows[0].pages[0].rows[0].id).toBe("row-1");
		expect(next.activeRowId).toBe("row-2");
	});

	it("MOVE_ROW_TO_FOOTER moves row across pages", () => {
		const state = initialState({
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
			activePageId: "page-1",
		});
		const next = pageReducer(state, {
			type: "MOVE_ROW_TO_FOOTER",
			rowId: "row-1",
			originPageId: "page-1",
			destinationPageId: "page-2",
		});
		expect(next.flows[0].pages[0].rows.length).toBe(0);
		expect(next.flows[0].pages[1].footer).toBeDefined();
		expect(next.flows[0].pages[1].footer?.id).toBe("row-1");
		expect(next.activeRowId).toBe("row-1");
	});

	it("ADD_ROW inserts palette row as child of footer descendant (blank child page drop)", () => {
		// Build a footer subtree:
		// footer-root (ListContainer)
		//   └── footer-parent (Text, no child yet)
		const footerParent = textRow("footer-parent");
		const footerRoot = containerRow("footer-root", footerParent);
		const state = initialState({
			flows: [
				{
					id: "flow-1",
					name: "Flow",
					pages: [
						{
							id: "page-1",
							title: "Page",
							rows: [textRow("row-1")],
							footer: footerRoot,
						},
					],
				},
			],
		});
		const newId = "new-footer-child";
		const next = pageReducer(state, {
			type: "ADD_ROW",
			newRowId: newId,
			oldRowId: "TextRow",
			destinationPageId: "page-1",
			destinationIndex: 0,
			destinationContainer: { rowId: "footer-parent", type: "child" },
		});

		// The new row should be inserted as child of footer-parent
		const footerAfter = next.flows[0].pages[0].footer;
		expect(footerAfter).toBeDefined();
		expect(footerAfter?.id).toBe("footer-root");
		expect(footerAfter?.config.view.content.child?.id).toBe(
			"footer-parent",
		);
		expect(
			footerAfter?.config.view.content.child?.config.view.content.child
				?.id,
		).toBe(newId);

		// Selection / config stack should reflect the new child chain.
		// The path starts from the footer root (the page-level entry point).
		expect(next.activeRowId).toBe("footer-root");
		expect(next.configStack).toEqual(["footer-parent", newId]);
		expect(next.activePageId).toBe("page-1");
	});
});
