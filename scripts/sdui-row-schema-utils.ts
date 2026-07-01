import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadJson, SDUI_DEFINITIONS_DIR } from "./types-generation-utils.js";

const UI_ROW_REF = "../evy.schema.json#/$defs/UI_Row";
const ACTION_REF = "../action.schema.json";
const UI_ROW_BASE_REF = "../evy.schema.json#/$defs/UI_RowBase";

type SduiRowSpecType =
	| "string"
	| "integer"
	| "[String]"
	| "UI_Row"
	| "[UI_Row]"
	| "[UI_RowAction]";

type SduiRowAttributeType =
	| "string"
	| "string[]"
	| "Row"
	| "Row[]"
	| "Action[]";

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

export interface SduiRowDefinition {
	type: string;
	attributes: Record<
		string,
		{ required: boolean; type: SduiRowAttributeType }
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
		if (items.$ref === ACTION_REF) return "Action[]";
	}

	throw new Error(`${label} uses an unsupported SDUI row property schema`);
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
		case "Action[]":
			return "[UI_RowAction]";
	}
}

export function extractSduiRowDefinition(
	schema: SduiRowDefinitionSchema,
	sourceLabel: string,
): SduiRowDefinition {
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
		attributes[name] = {
			required: required.has(name),
			type: attributeTypeForProperty(
				propertySchema,
				`${sourceLabel}: properties.${name}`,
			),
		};
	}

	return { type, attributes, schema };
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

const SCHEMA_TO_UI_FIELD_NAME: Record<string, string> = {
	child: "childRowId",
	children: "childrenRowIds",
};

export type RowFieldSpecKind =
	| "text"
	| "textList"
	| "child"
	| "children"
	| "binding";

export type RowFieldSpec = {
	name: string;
	kind: RowFieldSpecKind;
	required: boolean;
};

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

	let kind: Exclude<RowFieldSpecKind, "binding"> | null = null;
	switch (attribute.type) {
		case "string":
			kind = "text";
			break;
		case "string[]":
			kind = "textList";
			break;
		case "Row":
			kind = "child";
			break;
		case "Row[]":
			kind = "children";
			break;
		case "Action[]":
			return null;
	}

	return {
		name: SCHEMA_TO_UI_FIELD_NAME[schemaName] ?? schemaName,
		kind,
		required: attribute.required,
	};
}

export function rowFieldsFromDefinitions(
	definitions: SduiRowDefinition[],
): Record<string, RowFieldSpec[]> {
	const rowFields: Record<string, RowFieldSpec[]> = {};
	for (const definition of definitions) {
		const fields: RowFieldSpec[] = [];
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
