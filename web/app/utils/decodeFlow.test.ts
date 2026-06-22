import { describe, expect, it } from "bun:test";
import type { UI_Flow as ServerFlow, UI_Row as ServerRow } from "evy-types";
import invariant from "tiny-invariant";

import { validateUiFlow } from "../../../types/validators";
import SearchRow from "../rows/edit/SearchRow";
import {
	buildRowForNewPageFromBase,
	decodeFlows,
	encodeFlow,
	normalizeServerFlow,
	normalizeServerRow,
} from "./decodeFlow";

const FLOW_ID = "f267c629-2594-4770-8cec-d5324ebb4058";
const PAGE_ID = "55e427ac-263c-441f-9673-f60627b1baea";
const ROW_A = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROW_B = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

function makeServerRow(overrides: Record<string, unknown> = {}): ServerRow {
	return {
		id: ROW_A,
		source: "",
		visible: "",
		actions: [],
		view: { content: {} },
		...overrides,
	} as unknown as ServerRow;
}

describe("normalizeServerRow", () => {
	it("fills root string defaults and empty destination when omitted", () => {
		const partial = makeServerRow({
			type: "Button",
			view: {
				content: {
					label: "OK",
				},
			},
			actions: [{ condition: "", false: "", true: "{close()}" }],
		});

		const n = normalizeServerRow(partial);
		expect(n.source).toBe("");
		expect(n.destination).toBe("");
		expect(n.view.content).toMatchObject({
			title: "",
			label: "OK",
		});
	});

	it("does not merge Text content string fields from defaults when missing", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Text",
				view: {
					content: {
						title: "T",
						subtitle: "Sub",
					},
				},
			}),
		);

		expect(n.view.content).toEqual({
			title: "T",
			subtitle: "Sub",
		});
	});

	it("preserves Text content keys as sent by the server", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Text",
				view: {
					content: {
						title: "T",
						text: "extra",
						subtitle: "",
						icon: "",
					},
				},
			}),
		);

		expect((n.view.content as { text?: string }).text).toBe("extra");
	});

	it("normalizes Map row without replacing live non-string location", () => {
		const location = { latitude: -33.8688, longitude: 151.2093 };
		const n = normalizeServerRow(
			makeServerRow({
				type: "Map",
				view: {
					content: {
						title: "Pickup location",
						location,
					},
				},
			}),
		);

		expect(n.view.content as unknown).toEqual({
			title: "Pickup location",
			location,
		});
	});

	it("normalizes nested rows in children", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "ListContainer",
				view: {
					content: {
						title: "List",
						children: [
							makeServerRow({
								id: ROW_B,
								type: "Button",
								view: {
									content: {
										label: "Go",
									},
								},
							}),
						],
					},
				},
			}),
		);

		const first = n.view.content.children?.[0];
		expect(first?.type).toBe("Button");
		expect(first?.destination).toBe("");
		expect(first?.view.content).toMatchObject({
			title: "",
			label: "Go",
		});
	});

	it("normalizes nested child template for ListContainer without injecting defaults", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "ListContainer",
				source: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd}",
				view: {
					content: {
						title: "List",
						child: makeServerRow({
							id: ROW_B,
							type: "Text",
							view: {
								content: {
									title: "{$datum.title}",
								},
							},
						}),
						children: [],
					},
				},
			}),
		);

		expect(n.view.content.child?.type).toBe("Text");
		expect(n.view.content.child?.destination).toBe("");
		expect(n.view.content.child?.view.content).toEqual({
			title: "{$datum.title}",
		});
	});

	it("does not use default segments when segments key is omitted", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "SelectSegmentContainer",
				view: {
					content: {
						title: "Tabs",
						children: [],
					},
				},
			}),
		);

		expect(n.view.content).toEqual({
			title: "Tabs",
			children: [],
		});
	});

	it("does not merge Search child from palette when server omits child", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Search",
				source: "{tags}",
				destination: "",
				view: {
					content: {
						title: "Find",
						placeholder: "Search",
					},
				},
			}),
		);

		expect(n.view.content).toEqual({
			title: "Find",
			placeholder: "Search",
		});
	});
});

describe("decodeFlows / encodeFlow", () => {
	it("round-trips to the same normalized server shape as normalizeServerFlow", () => {
		const raw: ServerFlow = {
			id: FLOW_ID,
			name: "F",
			pages: [
				{
					id: PAGE_ID,
					title: "P",
					rows: [
						{
							id: ROW_A,
							type: "Text",
							source: "",
							actions: [],
							visible:
								"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
							view: {
								content: {
									title: "Hello",
									text: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.title}",
								},
								max_lines: "",
							},
						},
					],
				},
			],
		};

		const validated = validateUiFlow(raw);
		const canonical = normalizeServerFlow(validated);
		const decoded = decodeFlows([validated])[0];
		const encoded = encodeFlow(decoded);
		expect(encoded).toEqual(canonical);
	});
});

describe("decodeRow unknown types", () => {
	it("preserves visible on unknown row config", () => {
		const unknownRow = makeServerRow({
			id: ROW_B,
			type: "FutureRow",
			visible:
				"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
			view: {
				content: { title: "Future" },
			},
		});
		const flow = {
			id: FLOW_ID,
			name: "F",
			pages: [{ id: PAGE_ID, title: "P", rows: [unknownRow] }],
		} as ServerFlow;
		const decoded = decodeFlows([flow])[0];
		const row = decoded.pages[0]?.rows[0];
		expect(String(row?.config.type)).toBe("FutureRow");
		expect(row?.config.visible).toBe(
			"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
		);
		expect(encodeFlow(decoded).pages[0]?.rows[0]?.visible).toBe(
			"{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_methods.cash == true}",
		);
	});
});

describe("buildRowForNewPageFromBase", () => {
	it("preserves only title test text and structural child for a new Search row", () => {
		const newId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const row = buildRowForNewPageFromBase(SearchRow, newId);
		expect(row.id).toBe(newId);
		expect(row.config.type).toBe("Search");
		expect(row.config.view.content.title).toBe("Search row title");
		expect(row.config.view.content.placeholder).toBe("");
		const child = row.config.view.content.child;
		invariant(child, "search row template child");
		const childId = child.id;
		expect(childId).toBeDefined();
		expect(childId).not.toBe("09f07052-c27c-4116-a508-a2bcb074c827");
		expect(child.config.view.content).toMatchObject({
			title: "{$datum.value}",
			subtitle: "",
			label: "",
		});
	});
});
