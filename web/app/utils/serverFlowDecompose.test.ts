import { describe, expect, it } from "bun:test";
import type { UI_Flow as ServerFlow } from "evy-types";
import { decomposeServerFlow } from "./serverFlowDecompose";

const NOW = "2024-01-01T00:00:00.000Z";

describe("serverFlowDecompose", () => {
	it("decomposes nested sheet and Search child into distinct keys", () => {
		const flow: ServerFlow = {
			id: "flow-1",
			name: "Flow",
			pages: [
				{
					id: "page-1",
					name: "Page",
					title: "Page",
					rows: [
						{
							id: "search-1",
							type: "Search",
							visible: "true",
							title: "Search",
							actions: [],
							child: {
								id: "child-1",
								type: "Text",
								visible: "true",
								title: "Result",
								actions: [],
							},
							sheet: {
								id: "sheet-1",
								type: "Text",
								visible: "true",
								title: "Sheet",
								actions: [],
							},
						},
					],
				},
			],
		};

		const graph = decomposeServerFlow(flow, NOW);
		const searchRecord = graph.rowRows.find((r) => r.id === "search-1");
		expect(searchRecord?.data.child_row_id).toBe("child-1");
		expect(searchRecord?.data.sheet_row_id).toBe("sheet-1");
		expect(graph.rowRows.map((r) => r.id).sort()).toEqual(
			["child-1", "search-1", "sheet-1"].sort(),
		);
	});
});
