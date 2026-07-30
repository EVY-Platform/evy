import { describe, expect, test } from "bun:test";
import {
	assertExactSduiRowTypeCoverage,
	assertSduiRowDefinitionFileMatchesType,
	extractSduiRowDefinition,
	inheritedStructuralRowFields,
	loadSduiRowDefinitions,
	rowFieldsFromDefinitions,
	rowSpecFromDefinitions,
	rowSpecificAttributesTsSource,
	rowTriggersFromDefinitions,
} from "./sdui-row-schema-utils";

const calendarSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "sdui/definitions/Calendar",
	title: "Calendar_Row",
	triggers: { tap: "required" },
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
				type: { const: "calendar" },
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

		expect(definition.type).toBe("calendar");
		expect(definition.triggers).toEqual({ tap: "required" });
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

	test("maps row, row array, and string array attributes into row specs", () => {
		const definition = extractSduiRowDefinition(
			{
				triggers: { tap: "optional" },
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type", "child", "children", "segments"],
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
		});
		expect(rowSpecFromDefinitions([definition])).toEqual({
			Fixture: {
				content: {
					child: { type: "UI_Row", required: true },
					children: { type: "[UI_Row]", required: true },
					segments: { type: "[String]", required: true },
				},
			},
		});
	});

	test("rejects unsupported property schemas", () => {
		expect(() =>
			extractSduiRowDefinition(
				{
					triggers: { tap: "optional" },
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

describe("rowTriggersFromDefinitions", () => {
	test("maps triggers metadata into registry entries", () => {
		const button = extractSduiRowDefinition(
			{
				triggers: { tap: "required" },
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type", "label"],
						properties: {
							type: { const: "button" },
							label: { type: "string" },
						},
					},
				],
			},
			"Button.schema.json",
		);
		const selectPhoto = extractSduiRowDefinition(
			{
				triggers: { tap: "required", delete: "required" },
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type", "source", "destination"],
						properties: {
							type: { const: "select_photo" },
							source: { type: "string" },
							destination: { type: "string" },
						},
					},
				],
			},
			"SelectPhoto.schema.json",
		);

		expect(rowTriggersFromDefinitions([button, selectPhoto])).toEqual({
			button: [{ trigger: "tap", required: true }],
			select_photo: [
				{ trigger: "delete", required: true },
				{ trigger: "tap", required: true },
			],
		});
	});

	test("maps Calendar tap-row and tap-column triggers", () => {
		const calendar = extractSduiRowDefinition(
			{
				triggers: {
					tap: "required",
					tap_row: "required",
					tap_column: "required",
				},
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type", "source", "destination"],
						properties: {
							type: { const: "calendar" },
							source: { type: "string" },
							destination: { type: "string" },
						},
					},
				],
			},
			"Calendar.schema.json",
		);

		expect(calendar.triggers).toEqual({
			tap: "required",
			tap_row: "required",
			tap_column: "required",
		});
		expect(rowTriggersFromDefinitions([calendar])).toEqual({
			calendar: [
				{ trigger: "tap", required: true },
				{ trigger: "tap_column", required: true },
				{ trigger: "tap_row", required: true },
			],
		});
	});

	test("maps optional tap and submit triggers", () => {
		const input = extractSduiRowDefinition(
			{
				triggers: { tap: "optional", submit: "optional" },
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type", "source", "destination"],
						properties: {
							type: { const: "input" },
							source: { type: "string" },
							destination: { type: "string" },
						},
					},
				],
			},
			"Input.schema.json",
		);

		expect(input.triggers).toEqual({ tap: "optional", submit: "optional" });
		expect(rowTriggersFromDefinitions([input])).toEqual({
			input: [
				{ trigger: "submit", required: false },
				{ trigger: "tap", required: false },
			],
		});
	});

	test("maps optional swipe-left trigger", () => {
		const text = extractSduiRowDefinition(
			{
				triggers: {
					tap: "optional",
					swipe_left: "optional",
				},
				allOf: [
					{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
					{
						type: "object",
						required: ["type"],
						properties: {
							type: { const: "text" },
						},
					},
				],
			},
			"Text.schema.json",
		);

		expect(text.triggers).toEqual({
			tap: "optional",
			swipe_left: "optional",
		});
		expect(rowTriggersFromDefinitions([text])).toEqual({
			text: [
				{ trigger: "swipe_left", required: false },
				{ trigger: "tap", required: false },
			],
		});
	});

	test("rejects unknown trigger names and values", () => {
		expect(() =>
			extractSduiRowDefinition(
				{
					triggers: { "tap-and-hold": "required" },
					allOf: [
						{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
						{
							type: "object",
							required: ["type"],
							properties: { type: { const: "Broken" } },
						},
					],
				},
				"Broken.schema.json",
			),
		).toThrow('unknown trigger name "tap-and-hold"');

		expect(() =>
			extractSduiRowDefinition(
				{
					triggers: { tap: "maybe" },
					allOf: [
						{ $ref: "../evy.schema.json#/$defs/UI_RowBase" },
						{
							type: "object",
							required: ["type"],
							properties: { type: { const: "Broken" } },
						},
					],
				},
				"Broken.schema.json",
			),
		).toThrow('trigger "tap" must be "required" or "optional"');
	});
});

describe("rowFieldsFromDefinitions", () => {
	test("maps schema attributes to panel field specs with UI names and binding kinds", () => {
		const definition = extractSduiRowDefinition(
			{
				triggers: { tap: "optional" },
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
							style: {
								type: "string",
								enum: ["primary", "danger"],
							},
						},
					},
				],
			},
			"Fixture.schema.json",
		);

		expect(rowFieldsFromDefinitions([definition])).toEqual({
			Fixture: [
				{
					name: "sheet_row_id",
					kind: "sheet",
					required: false,
				},
				{
					name: "child_row_id",
					kind: "child",
					required: true,
				},
				{
					name: "children_row_ids",
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
				{
					name: "style",
					kind: "enum",
					required: false,
					options: ["primary", "danger"],
				},
			],
		});
	});
});

describe("inherited structural sheet fields", () => {
	test("allowlists only sheet as an inherited structural field", () => {
		expect(inheritedStructuralRowFields()).toEqual([
			{ name: "sheet_row_id", kind: "sheet", required: false },
		]);
	});

	test("every live row type inherits optional sheet and only Search exposes child", async () => {
		const definitions = await loadSduiRowDefinitions();
		const rowFields = rowFieldsFromDefinitions(definitions);
		const rowSpec = rowSpecFromDefinitions(definitions);

		for (const definition of definitions) {
			expect(rowFields[definition.type]).toContainEqual({
				name: "sheet_row_id",
				kind: "sheet",
				required: false,
			});
			expect(rowSpec[definition.type]?.content.sheet).toBeUndefined();
		}

		const searchFields = rowFields.search ?? [];
		expect(searchFields).toContainEqual({
			name: "child_row_id",
			kind: "child",
			required: false,
		});

		for (const definition of definitions) {
			if (definition.type === "search") continue;
			expect(
				(rowFields[definition.type] ?? []).some(
					(field) => field.name === "child_row_id",
				),
			).toBe(false);
			expect(definition.attributes.child).toBeUndefined();
		}

		for (const containerType of [
			"vertical_container",
			"horizontal_container",
			"tab_container",
		]) {
			expect(
				definitions.find(
					(definition) => definition.type === containerType,
				)?.attributes.source,
			).toBeUndefined();
		}

		const specificAttributesSource =
			rowSpecificAttributesTsSource(definitions).join("\n");
		for (const baseField of [
			"id",
			"type",
			"actions",
			"visible",
			"title",
			"name",
			"sheet",
		]) {
			expect(specificAttributesSource).not.toContain(`\t${baseField}?:`);
		}
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
				["calendar"],
			),
		).toThrow("Duplicate SDUI row definition type values");

		expect(() =>
			assertExactSduiRowTypeCoverage(
				[definition],
				["calendar", "button"],
			),
		).toThrow("Missing SDUI definition");
	});
});
