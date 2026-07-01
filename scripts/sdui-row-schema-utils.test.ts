import { describe, expect, test } from "bun:test";
import {
	assertExactSduiRowTypeCoverage,
	assertSduiRowDefinitionFileMatchesType,
	extractSduiRowDefinition,
	rowFieldsFromDefinitions,
	rowSpecFromDefinitions,
} from "./sdui-row-schema-utils";

const calendarSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "sdui/definitions/Calendar",
	title: "Calendar_Row",
	allOf: [
		{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
		{
			type: "object",
			required: [
				"type",
				"start_time",
				"end_time",
				"timeslot_interval_minutes",
				"label_interval_minutes",
				"header_format",
				"timeslot_format",
				"source",
				"destination",
			],
			properties: {
				type: { const: "Calendar" },
				title: { type: "string" },
				start_time: { type: "string" },
				end_time: { type: "string" },
				timeslot_interval_minutes: { type: "string" },
				label_interval_minutes: { type: "string" },
				header_format: { type: "string" },
				timeslot_format: { type: "string" },
				source: { type: "string" },
				destination: { type: "string" },
				secondary: { type: "string" },
			},
		},
	],
	unevaluatedProperties: false,
};

describe("extractSduiRowDefinition", () => {
	test("extracts required, optional, and binding-like string attributes from a row schema", () => {
		const definition = extractSduiRowDefinition(
			calendarSchema,
			"Calendar.schema.json",
		);

		expect(definition.type).toBe("Calendar");
		expect(definition.attributes).toEqual({
			title: { required: false, type: "string" },
			start_time: { required: true, type: "string" },
			end_time: { required: true, type: "string" },
			timeslot_interval_minutes: { required: true, type: "string" },
			label_interval_minutes: { required: true, type: "string" },
			header_format: { required: true, type: "string" },
			timeslot_format: { required: true, type: "string" },
			source: { required: true, type: "string" },
			destination: { required: true, type: "string" },
			secondary: { required: false, type: "string" },
		});
	});

	test("maps row, row array, string array, and action array attributes into row specs", () => {
		const definition = extractSduiRowDefinition(
			{
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: [
							"type",
							"child",
							"children",
							"segments",
							"actions",
						],
						properties: {
							type: { const: "Fixture" },
							child: { $ref: "../evy.schema.json#/$defs/UI_Row" },
							children: {
								type: "array",
								items: {
									$ref: "../evy.schema.json#/$defs/UI_Row",
								},
							},
							segments: {
								type: "array",
								items: { type: "string" },
							},
							actions: {
								type: "array",
								items: { $ref: "../action.schema.json" },
							},
						},
					},
				],
			},
			"Fixture.schema.json",
		);

		expect(definition.attributes).toEqual({
			child: { required: true, type: "Row" },
			children: { required: true, type: "Row[]" },
			segments: { required: true, type: "string[]" },
			actions: { required: true, type: "Action[]" },
		});
		expect(rowSpecFromDefinitions([definition])).toEqual({
			Fixture: {
				content: {
					child: { type: "UI_Row", required: true },
					children: { type: "[UI_Row]", required: true },
					segments: { type: "[String]", required: true },
					actions: { type: "[UI_RowAction]", required: true },
				},
			},
		});
	});

	test("rejects unsupported property schemas", () => {
		expect(() =>
			extractSduiRowDefinition(
				{
					allOf: [
						{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
						{
							type: "object",
							required: ["type", "enabled"],
							properties: {
								type: { const: "Broken" },
								enabled: { type: "boolean" },
							},
						},
					],
				},
				"Broken.schema.json",
			),
		).toThrow("unsupported SDUI row property schema");
	});
});

describe("rowFieldsFromDefinitions", () => {
	test("maps schema attributes to panel field specs with UI names and binding kinds", () => {
		const definition = extractSduiRowDefinition(
			{
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: [
							"type",
							"child",
							"children",
							"segments",
							"destination",
						],
						properties: {
							type: { const: "Fixture" },
							child: { $ref: "../evy.schema.json#/$defs/UI_Row" },
							children: {
								type: "array",
								items: {
									$ref: "../evy.schema.json#/$defs/UI_Row",
								},
							},
							segments: {
								type: "array",
								items: { type: "string" },
							},
							destination: { type: "string" },
							source: { type: "string" },
						},
					},
				],
			},
			"Fixture.schema.json",
		);

		expect(rowFieldsFromDefinitions([definition])).toEqual({
			Fixture: [
				{
					name: "childRowId",
					kind: "child",
					required: true,
				},
				{
					name: "childrenRowIds",
					kind: "children",
					required: true,
				},
				{
					name: "segments",
					kind: "textList",
					required: true,
				},
				{
					name: "destination",
					kind: "binding",
					required: true,
				},
				{
					name: "source",
					kind: "binding",
					required: false,
				},
			],
		});
	});
});

describe("SDUI row schema invariants", () => {
	test("rejects schema definition invariant violations", () => {
		const definition = extractSduiRowDefinition(
			calendarSchema,
			"Calendar.schema.json",
		);

		expect(() =>
			assertSduiRowDefinitionFileMatchesType(
				"Wrong.schema.json",
				definition,
			),
		).toThrow("filename must match row type");

		expect(() =>
			assertExactSduiRowTypeCoverage(
				[definition, definition],
				["Calendar"],
			),
		).toThrow("Duplicate SDUI row definition type values");

		expect(() =>
			assertExactSduiRowTypeCoverage(
				[definition],
				["Calendar", "Button"],
			),
		).toThrow("Missing SDUI definition");
	});
});
