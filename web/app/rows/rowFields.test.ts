import { describe, expect, test } from "bun:test";
import { SDUI_ROW_FIELDS } from "evy-types";
import {
	compareRowFieldsForPanel,
	getRowBindingFields,
	getRowContentFields,
	type RowField,
} from "./rowFields";

const ALL_ROW_TYPES = Object.keys(SDUI_ROW_FIELDS);
const INITIAL_SUPPORTED_TYPES = ALL_ROW_TYPES.filter((type) =>
	getRowContentFields(type).some((field) => field.name === "initial"),
);
const INITIAL_UNSUPPORTED_TYPES = ALL_ROW_TYPES.filter(
	(type) => !INITIAL_SUPPORTED_TYPES.includes(type),
);

describe("rowFields", () => {
	test("separates binding fields from content fields", () => {
		const bindingFields = getRowBindingFields("input");
		const contentFields = getRowContentFields("input");
		const contentNames = contentFields.map((field) => field.name);

		expect(bindingFields.length).toBeGreaterThan(0);
		for (const bindingField of bindingFields) {
			expect(contentNames).not.toContain(bindingField);
		}
	});

	test("exposes optional text field initial for the four supported row types", () => {
		for (const type of INITIAL_SUPPORTED_TYPES) {
			const contentFields = getRowContentFields(type);
			const initialField = contentFields.find(
				(f) => f.name === "initial",
			);
			expect(initialField).toEqual({
				name: "initial",
				kind: "text",
				required: false,
			});
		}
	});

	test("does not expose initial for unsupported row types", () => {
		for (const type of INITIAL_UNSUPPORTED_TYPES) {
			const contentFields = getRowContentFields(type);
			const initialField = contentFields.find(
				(f) => f.name === "initial",
			);
			expect(initialField).toBeUndefined();
		}
	});

	test("never classifies initial as a binding field", () => {
		for (const type of ALL_ROW_TYPES) {
			const bindingFields = getRowBindingFields(type);
			expect(bindingFields).not.toContain("initial");
		}
	});

	test("exposes Button style as an enum field from the schema", () => {
		const contentFields = getRowContentFields("button");
		const styleField = contentFields.find((f) => f.name === "style");
		expect(styleField).toEqual({
			name: "style",
			kind: "enum",
			required: false,
			options: ["primary", "danger"],
		});
	});

	test("exposes Search no_results as an optional text field from the schema", () => {
		const contentFields = getRowContentFields("search");
		const noResultsField = contentFields.find(
			(f) => f.name === "no_results",
		);
		expect(noResultsField).toEqual({
			name: "no_results",
			kind: "text",
			required: false,
		});
	});

	test("exposes optional sheet on every row type", () => {
		for (const type of ALL_ROW_TYPES) {
			const sheetField = getRowContentFields(type).find(
				(f) => f.kind === "sheet",
			);
			expect(sheetField).toEqual({
				name: "sheet_row_id",
				kind: "sheet",
				required: false,
			});
		}
	});

	test("exposes child only on Search", () => {
		for (const type of ALL_ROW_TYPES) {
			const childField = getRowContentFields(type).find(
				(f) => f.kind === "child",
			);
			if (type === "search") {
				expect(childField).toEqual({
					name: "child_row_id",
					kind: "child",
					required: false,
				});
			} else {
				expect(childField).toBeUndefined();
			}
		}
	});

	test("exposes children only on Search and container rows", () => {
		for (const type of ALL_ROW_TYPES) {
			const childrenField = getRowContentFields(type).find(
				(f) => f.kind === "children",
			);
			if (
				type === "search" ||
				type === "vertical_container" ||
				type === "horizontal_container" ||
				type === "tab_container"
			) {
				expect(childrenField).toEqual({
					name: "children_row_ids",
					kind: "children",
					required: type !== "search",
				});
			} else {
				expect(childrenField).toBeUndefined();
			}
		}
	});

	test("orders panel fields by configured rank before fallback ordering", () => {
		function field(
			name: string,
			kind: RowField["kind"] = "text",
		): RowField {
			return { name, kind, required: false };
		}

		expect(
			compareRowFieldsForPanel(field("title"), field("label")),
		).toBeLessThan(0);
		expect(
			compareRowFieldsForPanel(field("placeholder"), field("value")),
		).toBeLessThan(0);
		expect(
			compareRowFieldsForPanel(
				field("child_row_id", "child"),
				field("children_row_ids", "children"),
			),
		).toBeLessThan(0);
		expect(
			compareRowFieldsForPanel(field("alpha"), field("beta")),
		).toBeLessThan(0);
	});
});
