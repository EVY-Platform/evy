import { describe, expect, it } from "bun:test";
import type { UI_Flow as ServerFlow, UI_Row as ServerRow } from "evy-types";

import { validateUiFlow } from "../../../types/validators";
import {
	decodeFlows,
	encodeFlow,
	normalizeServerFlow,
	normalizeServerRow,
} from "./decodeFlow";

const FLOW_ID = "f267c629-2594-4770-8cec-d5324ebb4058";
const PAGE_ID = "55e427ac-263c-441f-9673-f60627b1baea";
const ROW_A = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROW_B = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

describe("normalizeServerRow", () => {
	it("fills root string defaults and empty destination when omitted", () => {
		const partial = {
			id: ROW_A,
			type: "Button",
			view: {
				content: {
					label: "OK",
				},
			},
			actions: [{ condition: "", false: "", true: "close" }],
		} as unknown as ServerRow;

		const n = normalizeServerRow(partial);
		expect(n.source).toBe("");
		expect(n.destination).toBe("");
		expect(n.view.content).toMatchObject({
			title: "",
			label: "OK",
		});
	});

	it("merges Info content string fields from defaults when missing", () => {
		const n = normalizeServerRow({
			id: ROW_A,
			type: "Info",
			source: "{item}",
			actions: [],
			view: {
				content: {
					title: "T",
					subtitle: "Sub",
				},
			},
		} as ServerRow);

		expect(n.view.content).toMatchObject({
			title: "T",
			subtitle: "Sub",
			icon: "",
		});
	});

	it("preserves Info content keys as sent by the server", () => {
		const n = normalizeServerRow({
			id: ROW_A,
			type: "Info",
			source: "",
			actions: [],
			view: {
				content: {
					title: "T",
					text: "extra",
					subtitle: "",
					icon: "",
				},
			},
		} as ServerRow);

		expect((n.view.content as { text?: string }).text).toBe("extra");
	});

	it("normalizes nested rows in children", () => {
		const n = normalizeServerRow({
			id: ROW_A,
			type: "ListContainer",
			source: "",
			actions: [],
			view: {
				content: {
					title: "List",
					children: [
						{
							id: ROW_B,
							type: "Button",
							source: "",
							actions: [],
							view: {
								content: {
									label: "Go",
								},
							},
						} as unknown as ServerRow,
					],
				},
			},
		} as ServerRow);

		const first = n.view.content.children?.[0];
		expect(first?.type).toBe("Button");
		expect(first?.destination).toBe("");
		expect(first?.view.content).toMatchObject({
			title: "",
			label: "Go",
		});
	});

	it("uses default segments when segments key is omitted", () => {
		const n = normalizeServerRow({
			id: ROW_A,
			type: "SelectSegmentContainer",
			source: "",
			actions: [],
			view: {
				content: {
					title: "Tabs",
					children: [],
				},
			},
		} as ServerRow);

		expect(n.view.content.segments).toEqual(["X", "Y", "Z"]);
	});

	it("merges Search child from palette when server omits child", () => {
		const n = normalizeServerRow({
			id: ROW_A,
			type: "Search",
			source: "{api:tags}",
			destination: "{tags}",
			actions: [],
			view: {
				content: {
					title: "Find",
					placeholder: "Search",
				},
			},
		} as ServerRow);

		expect(n.view.content.child?.type).toBe("Info");
		expect(n.view.content.child?.view.content).toMatchObject({
			title: "{datum.value}",
			subtitle: "",
			icon: "",
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
							source: "{item}",
							actions: [],
							view: {
								content: {
									title: "Hello",
									text: "{x}",
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
