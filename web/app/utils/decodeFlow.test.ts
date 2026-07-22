import { describe, expect, it } from "bun:test";
import type { UI_Row as ServerRow } from "evy-types";
import SearchRow from "../rows/edit/SearchRow";
import TextExpandRow from "../rows/view/TextExpandRow";
import { buildRowForNewPageFromBase, normalizeServerRow } from "./decodeFlow";

const ROW_A = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROW_B = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

function makeServerRow(overrides: Record<string, unknown> = {}): ServerRow {
	return {
		id: ROW_A,
		type: "Text",
		visible: "",
		actions: [],
		title: "",
		...overrides,
	} as unknown as ServerRow;
}

describe("normalizeServerRow", () => {
	it("fills root string defaults without injecting binding fields for Button", () => {
		const partial = makeServerRow({
			type: "Button",
			label: "OK",
			actions: [{ condition: "", false: "", true: "{close()}" }],
		});

		const n = normalizeServerRow(partial);
		expect(n.source).toBeUndefined();
		expect(n.destination).toBeUndefined();
		expect(n).toMatchObject({
			title: "",
			label: "OK",
		});
	});

	it("preserves binding fields for Input rows", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Input",
				source: "{items.title}",
				destination: "{buildTitle(item.title)}",
				title: "Name",
			}),
		);

		expect(n.source).toBe("{items.title}");
		expect(n.destination).toBe("{buildTitle(item.title)}");
	});

	it("normalizes nested rows without injecting binding defaults", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "VerticalContainer",
				source: `{items}`,
				title: "List",
				child: makeServerRow({
					id: ROW_B,
					type: "Text",
					title: "{$datum.title}",
				}),
				children: [
					makeServerRow({
						id: ROW_B,
						type: "Button",
						label: "Go",
					}),
				],
			}),
		);

		const nestedChild = n.child as ServerRow | undefined;
		expect(nestedChild?.type).toBe("Text");
		expect(nestedChild?.destination).toBeUndefined();
		expect(rowAttributes(nestedChild)).toEqual({
			title: "{$datum.title}",
		});

		const firstChild = Array.isArray(n.children)
			? (n.children[0] as ServerRow | undefined)
			: undefined;
		expect(firstChild?.type).toBe("Button");
		expect(firstChild?.destination).toBeUndefined();
		expect(firstChild).toMatchObject({
			title: "",
			label: "Go",
		});
	});
});

describe("normalizeServerRow sheet relationships", () => {
	it("normalizes nested sheet separately from Search child", () => {
		const n = normalizeServerRow(
			makeServerRow({
				type: "Search",
				title: "Search",
				child: makeServerRow({
					id: ROW_B,
					type: "Text",
					title: "Result",
				}),
				sheet: makeServerRow({
					id: ROW_A,
					type: "Text",
					title: "Sheet",
				}),
			}),
		);

		expect((n.child as ServerRow | undefined)?.id).toBe(ROW_B);
		expect((n.sheet as ServerRow | undefined)?.id).toBe(ROW_A);
	});
});

describe("buildRowForNewPageFromBase", () => {
	it("does not create a default child for a new Search row", () => {
		const newId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const row = buildRowForNewPageFromBase(SearchRow, newId);
		expect(row.id).toBe(newId);
		expect(row.config.type).toBe("Search");
		expect(row.config.title).toBe("Search row title");
		expect(row.config.placeholder).toBe("");
		expect(row.config.source).toBe("");
		expect(row.config.destination).toBe("");
		expect(row.config.child).toBeUndefined();
		expect(row.config.childRowId).toBeUndefined();
	});

	it("stamps expand_text with the new row id for TextExpand rows", () => {
		const newId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const row = buildRowForNewPageFromBase(TextExpandRow, newId);
		expect(row.id).toBe(newId);
		expect(row.config.type).toBe("TextExpand");
		expect(row.config.actions).toEqual([
			{
				condition: "",
				true: `{expand_text(${newId})}`,
				false: "",
			},
		]);
	});
});

function rowAttributes(row: ServerRow | undefined): Record<string, unknown> {
	if (!row) return {};
	const {
		id: _id,
		type: _type,
		source: _source,
		destination: _destination,
		secondary: _secondary,
		actions: _actions,
		visible: _visible,
		...attributes
	} = row as ServerRow & Record<string, unknown>;
	return attributes;
}
