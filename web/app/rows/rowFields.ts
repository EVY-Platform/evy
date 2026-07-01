import { SDUI_ROW_FIELDS } from "evy-types";

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

export type RowFieldKind = "text" | "textList" | "child" | "children";

export type RowField = {
	name: string;
	kind: RowFieldKind;
	required: boolean;
};

function rowFieldSpecs(type: string) {
	return SDUI_ROW_FIELDS[type] ?? [];
}

export function getRowContentFields(type: string): RowField[] {
	return rowFieldSpecs(type)
		.filter((field) => field.kind !== "binding")
		.map((field) => ({
			name: field.name,
			kind: field.kind as RowFieldKind,
			required: field.required,
		}));
}

export function getRowBindingFields(type: string): RowBindingField[] {
	return rowFieldSpecs(type)
		.filter((field) => field.kind === "binding")
		.map((field) => field.name as RowBindingField);
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
	for (const fields of Object.values(SDUI_ROW_FIELDS)) {
		for (const field of fields) {
			if (field.kind === "text" || field.kind === "textList") {
				names.add(field.name);
			}
		}
	}
	return [...names];
}

export function getAllRowBindingFieldNames(): string[] {
	const names = new Set<string>();
	for (const fields of Object.values(SDUI_ROW_FIELDS)) {
		for (const field of fields) {
			if (field.kind === "binding") {
				names.add(field.name);
			}
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
