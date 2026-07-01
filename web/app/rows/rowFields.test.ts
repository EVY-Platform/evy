import { describe, expect, test } from "bun:test";
import {
	compareRowFieldsForPanel,
	getRowBindingFields,
	getRowContentFields,
	type RowField,
} from "./rowFields";

describe("rowFields", () => {
	test("separates binding fields from content fields", () => {
		expect(getRowBindingFields("Input")).toEqual(["source", "destination"]);
		expect(getRowBindingFields("Calendar")).toEqual([
			"source",
			"destination",
			"secondary",
		]);
		expect(getRowBindingFields("Button")).toEqual([]);

		const inputFields = getRowContentFields("Input");
		const inputNames = inputFields.map((field) => field.name);
		expect(inputNames).toContain("title");
		expect(inputNames).toContain("placeholder");
		expect(inputNames).not.toContain("source");
		expect(inputNames).not.toContain("destination");
		for (const field of inputFields) {
			expect(field.kind).toBe("text");
		}
	});

	test("maps row content schema fields to configuration panel field kinds", () => {
		const segmentFields = getRowContentFields("SelectSegmentContainer");
		expect(
			segmentFields.find((field) => field.name === "segments"),
		).toEqual({
			name: "segments",
			kind: "textList",
			required: true,
		});

		const listFields = getRowContentFields("ListContainer");
		const listNames = listFields.map((field) => field.name);
		expect(listNames).toContain("childRowId");
		expect(listNames).toContain("childrenRowIds");
		expect(listNames).not.toContain("child");
		expect(listNames).not.toContain("children");
		expect(
			listFields.find((field) => field.name === "childRowId")?.kind,
		).toBe("child");
		expect(
			listFields.find((field) => field.name === "childrenRowIds")?.kind,
		).toBe("children");
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
	});

	test("title is required only for Heading", () => {
		expect(
			getRowContentFields("Heading").find((f) => f.name === "title")
				?.required,
		).toBe(true);
		for (const type of [
			"Button",
			"Calendar",
			"Dropdown",
			"Input",
			"Text",
			"TimeslotPicker",
		]) {
			const titleField = getRowContentFields(type).find(
				(f) => f.name === "title",
			);
			if (titleField) {
				expect(titleField.required).toBe(false);
			}
		}
	});

	test("required content attributes match the row matrix", () => {
		const required = (type: string, field: string) =>
			getRowContentFields(type).find((f) => f.name === field)?.required;

		expect(required("Button", "label")).toBe(true);
		expect(required("Dropdown", "value")).toBe(true);
		expect(required("InlinePicker", "value")).toBe(true);
		expect(required("Calendar", "header_format")).toBe(true);
		expect(required("Calendar", "timeslot_format")).toBe(true);
		expect(required("TimeslotPicker", "header_format")).toBe(true);
		expect(required("TimeslotPicker", "timeslot_format")).toBe(true);
	});
});
