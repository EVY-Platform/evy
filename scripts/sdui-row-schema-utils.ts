import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadJson, SDUI_DEFINITIONS_DIR } from "./types-generation-utils.js";

const UI_ROW_REF = "../evy.schema.json#/$defs/UI_Row";
const UI_ROW_BASE_REF = "../evy.schema.json#/$defs/UI_RowBase";

type SduiRowSpecType = "string" | "[String]" | "UI_Row" | "[UI_Row]";

type SduiRowAttributeType = "string" | "string[]" | "Row" | "Row[]";

export type SduiRowSpecField = {
	type: SduiRowSpecType;
	required: boolean;
};

export type SduiRowSpec = Record<
	string,
	{
		content: Record<string, SduiRowSpecField>;
	}
>;

type SduiRowDefinitionSchema = Record<string, unknown>;

const ROW_TRIGGER_NAMES = [
	"tap",
	"delete",
	"tap-row",
	"tap-column",
	"slide-left",
] as const;

export type RowTriggerName = (typeof ROW_TRIGGER_NAMES)[number];

export type RowTriggerSpec = {
	trigger: RowTriggerName;
	required: boolean;
};

const ROW_TRIGGER_NAME_SET = new Set<string>(ROW_TRIGGER_NAMES);
const ROW_TRIGGER_REQUIREMENTS = new Set(["required", "optional"]);

export interface SduiRowDefinition {
	type: string;
	triggers: Partial<Record<RowTriggerName, "required" | "optional">>;
	attributes: Record<
		string,
		{ required: boolean; type: SduiRowAttributeType; enum?: string[] }
	>;
	schema: SduiRowDefinitionSchema;
}

type SchemaObject = Record<string, unknown>;

function isSchemaObject(value: unknown): value is SchemaObject {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function getObject(value: unknown, label: string): SchemaObject {
	if (!isSchemaObject(value)) {
		throw new Error(`${label} must be an object`);
	}
	return value;
}

function getString(value: unknown, label: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`${label} must be a non-empty string`);
	}
	return value;
}

function getStringArray(value: unknown, label: string): string[] {
	if (
		!Array.isArray(value) ||
		!value.every((item) => typeof item === "string")
	) {
		throw new Error(`${label} must be an array of strings`);
	}
	return value;
}

function getRowSchemaBody(
	schema: SduiRowDefinitionSchema,
	sourceLabel: string,
) {
	const allOf = schema.allOf;
	if (!Array.isArray(allOf)) {
		throw new Error(
			`${sourceLabel}: allOf must include UI_RowBase and row properties`,
		);
	}

	const hasBaseRef = allOf.some(
		(entry) => isSchemaObject(entry) && entry.$ref === UI_ROW_BASE_REF,
	);
	if (!hasBaseRef) {
		throw new Error(
			`${sourceLabel}: allOf must reference ${UI_ROW_BASE_REF}`,
		);
	}

	const body = allOf.find(
		(entry) =>
			isSchemaObject(entry) &&
			isSchemaObject(entry.properties) &&
			isSchemaObject(entry.properties.type) &&
			typeof entry.properties.type.const === "string",
	);
	if (!body) {
		throw new Error(
			`${sourceLabel}: row properties must define properties.type.const`,
		);
	}
	return body;
}

function attributeTypeForProperty(
	propertySchema: unknown,
	label: string,
): SduiRowAttributeType {
	const schema = getObject(propertySchema, label);
	if (schema.type === "string") return "string";

	if (schema.$ref === UI_ROW_REF) return "Row";

	if (schema.type === "array") {
		const items = getObject(schema.items, `${label}.items`);
		if (items.type === "string") return "string[]";
		if (items.$ref === UI_ROW_REF) return "Row[]";
	}

	throw new Error(`${label} uses an unsupported SDUI row property schema`);
}

function attributeEnumValues(
	propertySchema: unknown,
	label: string,
): string[] | undefined {
	const schema = getObject(propertySchema, label);
	if (schema.type !== "string" || schema.enum === undefined) {
		return undefined;
	}
	return getStringArray(schema.enum, `${label}.enum`);
}

function specTypeForAttributeType(type: SduiRowAttributeType): SduiRowSpecType {
	switch (type) {
		case "string":
			return "string";
		case "string[]":
			return "[String]";
		case "Row":
			return "UI_Row";
		case "Row[]":
			return "[UI_Row]";
	}
}

function parseTriggersFromSchema(
	schema: SduiRowDefinitionSchema,
	sourceLabel: string,
): SduiRowDefinition["triggers"] {
	const raw = schema.triggers;
	if (!isSchemaObject(raw)) {
		throw new Error(`${sourceLabel}: triggers must be an object`);
	}
	const triggers: Partial<Record<RowTriggerName, "required" | "optional">> =
		{};
	for (const [name, value] of Object.entries(raw)) {
		if (!ROW_TRIGGER_NAME_SET.has(name)) {
			throw new Error(
				`${sourceLabel}: unknown trigger name "${name}" (allowed: ${ROW_TRIGGER_NAMES.join(", ")})`,
			);
		}
		if (typeof value !== "string" || !ROW_TRIGGER_REQUIREMENTS.has(value)) {
			throw new Error(
				`${sourceLabel}: trigger "${name}" must be "required" or "optional"`,
			);
		}
		triggers[name as RowTriggerName] = value;
	}
	return triggers;
}

export function extractSduiRowDefinition(
	schema: SduiRowDefinitionSchema,
	sourceLabel: string,
): SduiRowDefinition {
	const triggers = parseTriggersFromSchema(schema, sourceLabel);
	const body = getRowSchemaBody(schema, sourceLabel);
	const properties = getObject(body.properties, `${sourceLabel}: properties`);
	const typeProperty = getObject(
		properties.type,
		`${sourceLabel}: properties.type`,
	);
	const type = getString(
		typeProperty.const,
		`${sourceLabel}: properties.type.const`,
	);
	const required = new Set(
		getStringArray(body.required, `${sourceLabel}: required`),
	);

	const attributes: SduiRowDefinition["attributes"] = {};
	for (const [name, propertySchema] of Object.entries(properties)) {
		if (name === "type") continue;
		const propertyLabel = `${sourceLabel}: properties.${name}`;
		const enumValues = attributeEnumValues(propertySchema, propertyLabel);
		attributes[name] = {
			required: required.has(name),
			type: attributeTypeForProperty(propertySchema, propertyLabel),
			...(enumValues ? { enum: enumValues } : {}),
		};
	}

	return { type, triggers, attributes, schema };
}

export function rowSpecFromDefinitions(
	definitions: SduiRowDefinition[],
): SduiRowSpec {
	const rowSpec: SduiRowSpec = {};
	for (const definition of definitions) {
		rowSpec[definition.type] = {
			content: Object.fromEntries(
				Object.entries(definition.attributes).map(
					([name, attribute]) => [
						name,
						{
							type: specTypeForAttributeType(attribute.type),
							required: attribute.required,
						},
					],
				),
			),
		};
	}
	return rowSpec;
}

function assertUniqueSduiRowTypes(definitions: SduiRowDefinition[]): void {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const definition of definitions) {
		if (seen.has(definition.type)) duplicates.add(definition.type);
		seen.add(definition.type);
	}
	if (duplicates.size > 0) {
		throw new Error(
			`Duplicate SDUI row definition type values found: ${[...duplicates].join(", ")}`,
		);
	}
}

export function assertSduiRowDefinitionFileMatchesType(
	fileName: string,
	definition: SduiRowDefinition,
): void {
	const expectedFileName = `${definition.type}.schema.json`;
	if (basename(fileName) !== expectedFileName) {
		throw new Error(
			`${fileName}: filename must match row type (${expectedFileName})`,
		);
	}
}

export function assertExactSduiRowTypeCoverage(
	definitions: SduiRowDefinition[],
	rowTypes: string[],
): void {
	assertUniqueSduiRowTypes(definitions);

	const definedTypes = new Set(
		definitions.map((definition) => definition.type),
	);
	const expectedTypes = new Set(rowTypes);
	const missing = rowTypes.filter((type) => !definedTypes.has(type));
	if (missing.length > 0) {
		throw new Error(
			`Missing SDUI definition for row type(s): ${missing.join(", ")}`,
		);
	}

	const extra = [...definedTypes].filter((type) => !expectedTypes.has(type));
	if (extra.length > 0) {
		throw new Error(
			`SDUI definition(s) for unknown row type(s): ${extra.join(", ")}`,
		);
	}
}

export async function loadSduiRowDefinitions(): Promise<SduiRowDefinition[]> {
	const entries = await readdir(SDUI_DEFINITIONS_DIR);
	const files = entries
		.filter((name) => name.endsWith(".schema.json"))
		.sort();
	const definitions: SduiRowDefinition[] = [];
	for (const file of files) {
		const sourceLabel = `types/schema/sdui/definitions/${file}`;
		const schema = await loadJson<SduiRowDefinitionSchema>(
			join(SDUI_DEFINITIONS_DIR, file),
		);
		const definition = extractSduiRowDefinition(schema, sourceLabel);
		assertSduiRowDefinitionFileMatchesType(file, definition);
		definitions.push(definition);
	}
	assertUniqueSduiRowTypes(definitions);
	return definitions;
}

const ROW_BINDING_FIELD_NAMES = new Set(["source", "destination", "secondary"]);

/**
 * Universal structural fields inherited from UI_RowBase into every builder
 * row-field list. Keep this allowlist narrow — never dump all base metadata.
 */
export const INHERITED_STRUCTURAL_ROW_FIELDS = ["sheet"] as const;

const SCHEMA_TO_UI_FIELD_NAME: Record<string, string> = {
	child: "childRowId",
	children: "childrenRowIds",
	sheet: "sheetRowId",
};

const ROW_FIELD_SPEC_KINDS = [
	"text",
	"textList",
	"child",
	"children",
	"sheet",
	"binding",
	"enum",
] as const;

export type RowFieldSpecKind = (typeof ROW_FIELD_SPEC_KINDS)[number];

export type RowFieldSpec = {
	name: string;
	kind: RowFieldSpecKind;
	required: boolean;
	options?: string[];
};

/**
 * TS source emitted verbatim into definitions.generated.ts so the generated
 * types cannot drift from RowFieldSpecKind/RowFieldSpec above.
 */
export function rowFieldSpecTsSource(): string[] {
	return [
		`export type RowFieldSpecKind = ${ROW_FIELD_SPEC_KINDS.map(
			(kind) => `"${kind}"`,
		).join(" | ")};`,
		"",
		`export type RowFieldSpec = {`,
		`\tname: string;`,
		`\tkind: RowFieldSpecKind;`,
		`\trequired: boolean;`,
		`\toptions?: string[];`,
		`};`,
	];
}

function rowFieldSpecFromAttribute(
	schemaName: string,
	attribute: SduiRowDefinition["attributes"][string],
): RowFieldSpec | null {
	if (ROW_BINDING_FIELD_NAMES.has(schemaName)) {
		return {
			name: schemaName,
			kind: "binding",
			required: attribute.required,
		};
	}

	const name = SCHEMA_TO_UI_FIELD_NAME[schemaName] ?? schemaName;

	if (attribute.type === "string" && attribute.enum) {
		return {
			name,
			kind: "enum",
			required: attribute.required,
			options: attribute.enum,
		};
	}

	let kind: Exclude<RowFieldSpecKind, "binding" | "enum"> | null = null;
	switch (attribute.type) {
		case "string":
			kind = "text";
			break;
		case "string[]":
			kind = "textList";
			break;
		case "Row":
			kind = schemaName === "sheet" ? "sheet" : "child";
			break;
		case "Row[]":
			kind = "children";
			break;
	}

	return {
		name,
		kind,
		required: attribute.required,
	};
}

export function inheritedStructuralRowFields(): RowFieldSpec[] {
	return INHERITED_STRUCTURAL_ROW_FIELDS.map((schemaName) => ({
		name: SCHEMA_TO_UI_FIELD_NAME[schemaName] ?? schemaName,
		kind: "sheet" as const,
		required: false,
	}));
}

/**
 * TS source for the union of every row-specific attribute across all
 * definitions (bindings and actions are base attributes, so excluded).
 * Row references are generic so UI layers can substitute their own row type.
 */
export function rowSpecificAttributesTsSource(
	definitions: SduiRowDefinition[],
): string[] {
	const fieldTypes = new Map<string, string>();
	for (const definition of definitions) {
		for (const [name, attribute] of Object.entries(definition.attributes)) {
			// Bindings and title are base attributes typed by consumers' own
			// base-attribute types; actions are base too.
			if (ROW_BINDING_FIELD_NAMES.has(name) || name === "title") continue;
			const tsType = {
				string: "string",
				"string[]": "string[]",
				Row: "TRow",
				"Row[]": "TRow[]",
			}[attribute.type];
			fieldTypes.set(name, tsType);
		}
	}
	const fieldLines = [...fieldTypes.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, tsType]) => `\t${name}?: ${tsType};`);
	return [
		`export type RowSpecificAttributes<TRow = unknown> = {`,
		...fieldLines,
		`};`,
	];
}

export function rowFieldsFromDefinitions(
	definitions: SduiRowDefinition[],
): Record<string, RowFieldSpec[]> {
	const inheritedFields = inheritedStructuralRowFields();
	const rowFields: Record<string, RowFieldSpec[]> = {};
	for (const definition of definitions) {
		const fields: RowFieldSpec[] = [...inheritedFields];
		for (const [schemaName, attribute] of Object.entries(
			definition.attributes,
		)) {
			const field = rowFieldSpecFromAttribute(schemaName, attribute);
			if (field) {
				fields.push(field);
			}
		}
		rowFields[definition.type] = fields;
	}
	return rowFields;
}

export function rowTriggersFromDefinitions(
	definitions: SduiRowDefinition[],
): Record<string, RowTriggerSpec[]> {
	const rowTriggers: Record<string, RowTriggerSpec[]> = {};
	for (const definition of definitions) {
		const specs: RowTriggerSpec[] = Object.entries(definition.triggers)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([trigger, requirement]) => ({
				trigger: trigger as RowTriggerName,
				required: requirement === "required",
			}));
		rowTriggers[definition.type] = specs;
	}
	return rowTriggers;
}

export function rowTriggersTsSource(): string[] {
	return [
		`export type RowTriggerName = "tap" | "delete" | "tap-row" | "tap-column" | "slide-left";`,
		``,
		`export type RowTriggerSpec = {`,
		`\ttrigger: RowTriggerName;`,
		`\trequired: boolean;`,
		`};`,
	];
}

export function extractSduiRowTypeEnum(
	schema: Record<string, unknown>,
): string[] {
	const defs = schema.$defs as Record<string, unknown> | undefined;
	const rowBaseDef = defs?.UI_RowBase as SchemaObject | undefined;
	const rowDef = defs?.UI_Row as SchemaObject | undefined;
	const definitionWithType = rowBaseDef ?? rowDef;
	const properties = definitionWithType?.properties as
		| SchemaObject
		| undefined;
	const typeProperty = properties?.type as { enum?: string[] } | undefined;
	return typeProperty?.enum ?? [];
}
