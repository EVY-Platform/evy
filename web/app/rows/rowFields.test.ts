import { describe, expect, test } from "bun:test";
import {
	compareRowFieldsForPanel,
	getRowBindingFields,
	getRowContentFields,
	type RowField,
} from "./rowFields";

describe("rowFields", () => {
	test("separates binding fields from content fields", () => {
		const bindingFields = getRowBindingFields("Input");
		const contentFields = getRowContentFields("Input");
		const contentNames = contentFields.map((field) => field.name);

		expect(bindingFields.length).toBeGreaterThan(0);
		for (const bindingField of bindingFields) {
			expect(contentNames).not.toContain(bindingField);
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
				field("childRowId", "child"),
				field("childrenRowIds", "children"),
			),
		).toBeLessThan(0);
		expect(
			compareRowFieldsForPanel(field("alpha"), field("beta")),
		).toBeLessThan(0);
	});
});
