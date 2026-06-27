import { describe, expect, it } from "bun:test";
import type { UI_Row as ServerRow } from "evy-types";
import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import invariant from "tiny-invariant";
import SearchRow, {
	SEARCH_RESULT_TEMPLATE_ROW_ID,
} from "../rows/edit/SearchRow";
import { buildRowForNewPageFromBase, normalizeServerRow } from "./decodeFlow";

const ROW_A = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROW_B = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

function makeServerRow(overrides: Record<string, unknown> = {}): ServerRow {
	return {
		id: ROW_A,
		type: "Text",
		source: "",
		visible: "",
		actions: [],
		title: "",
		...overrides,
	} as unknown as ServerRow;
}

describe("normalizeServerRow", () => {
	it("fills root string defaults and empty destination when omitted", () => {
		const partial = makeServerRow({
			type: "Button",
			label: "OK",
			actions: [{ condition: "", false: "", true: "{close()}" }],
		});

		const n = normalizeServerRow(partial);
		expect(n.source).toBe("");
		expect(n.destination).toBe("");
		expect(n).toMatchObject({
			title: "",
			label: "OK",
		});
	});

	it("does not merge Text string fields from defaults when missing", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Text",
				title: "T",
				subtitle: "Sub",
			}),
		);

		expect(rowAttributes(n)).toEqual({
			title: "T",
			subtitle: "Sub",
		});
	});

	it("preserves Text keys as sent by the server", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Text",
				title: "T",
				text: "extra",
				subtitle: "",
				icon: "",
			}),
		);

		expect(n.text).toBe("extra");
	});

	it("normalizes Map row without replacing live non-string location", () => {
		const location = { latitude: -33.8688, longitude: 151.2093 };
		const n = normalizeServerRow(
			makeServerRow({
				type: "Map",
				title: "Pickup location",
				location,
			}),
		);

		expect(rowAttributes(n)).toEqual({
			title: "Pickup location",
			location,
		});
	});

	it("normalizes nested rows in children", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "ListContainer",
				title: "List",
				children: [
					makeServerRow({
						id: ROW_B,
						type: "Button",
						label: "Go",
					}),
				],
			}),
		);

		const first = n.children?.[0];
		expect(first?.type).toBe("Button");
		expect(first?.destination).toBe("");
		expect(first).toMatchObject({
			title: "",
			label: "Go",
		});
	});

	it("normalizes nested child template for ListContainer without injecting defaults", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "ListContainer",
				source: `{${MARKETPLACE_RESOURCE.ITEMS}}`,
				title: "List",
				child: makeServerRow({
					id: ROW_B,
					type: "Text",
					title: "{$datum.title}",
				}),
				children: [],
			}),
		);

		expect(n.child?.type).toBe("Text");
		expect(n.child?.destination).toBe("");
		expect(rowAttributes(n.child)).toEqual({
			title: "{$datum.title}",
		});
	});

	it("does not use default segments when segments key is omitted", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "SelectSegmentContainer",
				title: "Tabs",
				children: [],
			}),
		);

		expect(rowAttributes(n)).toEqual({
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
				title: "Find",
				placeholder: "Search",
			}),
		);

		expect(rowAttributes(n)).toEqual({
			title: "Find",
			placeholder: "Search",
		});
	});
});

describe("buildRowForNewPageFromBase", () => {
	it("preserves only title test text and structural child for a new Search row", () => {
		const newId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const row = buildRowForNewPageFromBase(SearchRow, newId);
		expect(row.id).toBe(newId);
		expect(row.config.type).toBe("Search");
		expect(row.config.title).toBe("Search row title");
		expect(row.config.placeholder).toBe("");
		const child = row.config.child;
		invariant(child, "search row template child");
		const childId = child.id;
		expect(childId).toBeDefined();
		expect(childId).not.toBe(SEARCH_RESULT_TEMPLATE_ROW_ID);
		expect(child.config).toMatchObject({
			title: "{$datum.value}",
			subtitle: "",
			label: "",
		});
	});
});

function rowAttributes(row: ServerRow | undefined): Record<string, unknown> {
	if (!row) return {};
	const {
		id: _id,
		type: _type,
		source: _source,
		destination: _destination,
		actions: _actions,
		visible: _visible,
		...attributes
	} = row as ServerRow & Record<string, unknown>;
	return attributes;
}
