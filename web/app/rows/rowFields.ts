import { SDUI_DEFINITIONS } from "evy-types";

export type RowBindingField = "source" | "destination" | "secondary";

export const BINDING_FIELD_COPY: Record<
	RowBindingField,
	{ label: string; placeholder: string; ariaLabel: string }
> = {
	source: {
		label: "Source",
		placeholder: "Where the row reads data from",
		ariaLabel: "Row data source",
	},
	destination: {
		label: "Destination",
		placeholder: "Where the row writes data to",
		ariaLabel: "Row destination",
	},
	secondary: {
		label: "Secondary",
		placeholder: "Greyed-out timeslots source",
		ariaLabel: "Row secondary source",
	},
};

const ROW_BINDING_FIELD_NAMES = new Set<string>([
	"source",
	"destination",
	"secondary",
]);

export type RowFieldKind = "text" | "textList" | "child" | "children";

export type RowField = {
	name: string;
	kind: RowFieldKind;
	required: boolean;
};

const SCHEMA_TO_UI_NAME: Record<string, string> = {
	child: "childRowId",
	children: "childrenRowIds",
};

type SchemaObject = Record<string, unknown>;

function isSchemaObject(value: unknown): value is SchemaObject {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function getRowSchemaBody(type: string): SchemaObject | null {
	const schema = SDUI_DEFINITIONS[type];
	if (!isSchemaObject(schema)) return null;

	const allOf = schema.allOf;
	if (!Array.isArray(allOf)) return null;

	const body = allOf.find((entry): entry is SchemaObject => {
		if (!isSchemaObject(entry)) return false;
		const properties = entry.properties;
		if (!isSchemaObject(properties)) return false;
		const typeField = properties.type;
		return isSchemaObject(typeField) && typeof typeField.const === "string";
	});
	return body ?? null;
}

function fieldKindFromPropertySchema(propSchema: unknown): RowFieldKind | null {
	if (!isSchemaObject(propSchema)) return null;

	if (propSchema.type === "string") return "text";

	if (typeof propSchema.$ref === "string") {
		return propSchema.$ref.includes("UI_Row") ? "child" : null;
	}

	if (propSchema.type === "array" && isSchemaObject(propSchema.items)) {
		const items = propSchema.items;
		if (items.type === "string") return "textList";
		if (typeof items.$ref === "string" && items.$ref.includes("UI_Row"))
			return "children";
		// Action[] and other array types are handled elsewhere — skip
	}

	return null;
}

export function getRowContentFields(type: string): RowField[] {
	const body = getRowSchemaBody(type);
	if (!body) return [];

	const properties = body.properties as SchemaObject;
	const required = new Set(
		Array.isArray(body.required) ? (body.required as string[]) : [],
	);

	const result: RowField[] = [];
	for (const [name, propSchema] of Object.entries(properties)) {
		if (name === "type" || ROW_BINDING_FIELD_NAMES.has(name)) continue;
		const kind = fieldKindFromPropertySchema(propSchema);
		if (kind === null) continue;
		const uiName = SCHEMA_TO_UI_NAME[name] ?? name;
		result.push({ name: uiName, kind, required: required.has(name) });
	}
	return result;
}

export function getRowBindingFields(type: string): RowBindingField[] {
	const body = getRowSchemaBody(type);
	if (!body) return [];

	const properties = body.properties as SchemaObject;
	const bindingFields: RowBindingField[] = [];
	for (const name of ["source", "destination", "secondary"] as const) {
		if (name in properties) {
			bindingFields.push(name);
		}
	}
	return bindingFields;
}

export function readBindingFields(
	record: Record<string, unknown>,
	type: string,
): Record<string, string> {
	const bindingFields: Record<string, string> = {};
	for (const field of getRowBindingFields(type)) {
		const value = record[field];
		if (typeof value === "string") {
			bindingFields[field] = value;
		}
	}
	return bindingFields;
}

export const ROW_FIELD_PANEL_ORDER = [
	"icon",
	"title",
	"subtitle",
	"text",
	"placeholder",
] as const;

type PanelOrderName = (typeof ROW_FIELD_PANEL_ORDER)[number];

function panelTextFieldRank(name: string): number {
	const index = ROW_FIELD_PANEL_ORDER.indexOf(
		name.toLowerCase() as PanelOrderName,
	);
	return index === -1 ? ROW_FIELD_PANEL_ORDER.length : index;
}

export function getAllRowContentFieldNames(): string[] {
	const names = new Set<string>();
	for (const type of Object.keys(SDUI_DEFINITIONS)) {
		for (const field of getRowContentFields(type)) {
			if (field.kind === "text" || field.kind === "textList") {
				names.add(field.name);
			}
		}
	}
	return [...names];
}

export function getAllRowBindingFieldNames(): string[] {
	const names = new Set<string>();
	for (const type of Object.keys(SDUI_DEFINITIONS)) {
		for (const field of getRowBindingFields(type)) {
			names.add(field);
		}
	}
	return [...names];
}

export function compareRowFieldsForPanel(a: RowField, b: RowField): number {
	const aIsText = a.kind === "text" || a.kind === "textList";
	const bIsText = b.kind === "text" || b.kind === "textList";
	if (aIsText && bIsText) {
		const rankDiff =
			panelTextFieldRank(a.name) - panelTextFieldRank(b.name);
		return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
	}
	if (a.kind === "child" && b.kind === "children") return -1;
	if (a.kind === "children" && b.kind === "child") return 1;
	return a.name.localeCompare(b.name);
}
