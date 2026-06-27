/**
 * Generates Swift UI types from evy.schema.json and row-content.spec.json:
 * - UIEnums.swift (flow + row type enums)
 * - UIShapes.swift (Flow, Page, Row, RowView, RowContent, Action)
 * - UIRowPayloads.swift (per-row view/content structs + UI_RowPayload + from(row:) helper)
 * Run from repo root: bun run types:generate (called by generate-types.ts).
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	loadJson,
	OUT_SWIFT,
	runMain,
	SCHEMA_DIR,
} from "./types-generation-utils.js";

const UI_SCHEMA_PATH = join(SCHEMA_DIR, "sdui", "evy.schema.json");
const ROW_SPEC_PATH = join(SCHEMA_DIR, "sdui", "row-content.spec.json");

type RowSpec = Record<
	string,
	{
		content: Record<string, string>;
	}
>;

function swiftTypeForSpecType(s: string): string {
	switch (s) {
		case "string":
			return "String";
		case "integer":
			return "Int";
		case "[UI_Row]":
			return "[UI_Row]";
		case "UI_Row":
			return "UI_Row?";
		case "[String]":
			return "[String]";
		default:
			return "String";
	}
}

function rowTypeToEnumCase(rowType: string): string {
	const parts = rowType.split(/(?=[A-Z])/).map((p) => p.toLowerCase());
	return parts
		.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
		.join("");
}

function swiftIdentifier(name: string): string {
	return name === "true" || name === "false" ? `\`${name}\`` : name;
}

/** Row type list from row-content spec (single source of truth for UI_Row.type enum). */
function getRowTypesFromSpec(rowSpec: RowSpec): string[] {
	return Object.keys(rowSpec).sort();
}

// --- Schema traversal / type mapping for Swift emission ---

type SchemaObject = Record<string, unknown>;

/** Get Swift type for a JSON Schema property value (single type or ref). */
function swiftTypeForSchemaProp(
	propSchema: unknown,
	defName: string,
	propName: string,
	requiredKeys: string[],
	overrides: Map<string, string>,
): { swiftType: string; isOptional: boolean } {
	const key = `${defName}.${propName}`;
	const required = requiredKeys.includes(propName);
	const override = overrides.get(key);
	if (override) {
		return { swiftType: override, isOptional: !required };
	}
	const obj = propSchema as SchemaObject | undefined;
	if (!obj || typeof obj !== "object") {
		return { swiftType: "String", isOptional: !required };
	}
	const ref = obj.$ref as string | undefined;
	if (ref) {
		const refName = ref.replace("#/$defs/", "");
		return { swiftType: refName, isOptional: !required };
	}
	const schemaType = obj.type as string | undefined;
	const enumVal = obj.enum as string[] | undefined;
	if (enumVal) {
		// Enums are overridden by caller for Flow/Row type; otherwise String
		return { swiftType: "String", isOptional: !required };
	}
	if (schemaType === "string") {
		return { swiftType: "String", isOptional: !required };
	}
	if (schemaType === "integer" || schemaType === "number") {
		return { swiftType: "Int", isOptional: !required };
	}
	if (schemaType === "array") {
		const items = obj.items as SchemaObject | undefined;
		const itemRef = items?.$ref as string | undefined;
		if (itemRef) {
			const itemName = itemRef.replace("#/$defs/", "");
			return { swiftType: `[${itemName}]`, isOptional: !required };
		}
		return { swiftType: "[String]", isOptional: !required };
	}

	return { swiftType: "String", isOptional: !required };
}

function emitUIEnums(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const rowEnumCases: string[] = [];
	for (const t of rowTypes) {
		const camel = rowTypeToEnumCase(t);
		rowEnumCases.push(`    case ${camel} = "${t}"`);
	}

	return `// Generated from types/schema/sdui/evy.schema.json + row-content.spec.json - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.
// EVYRowType cases are derived from row-content.spec.json keys.

import Foundation

/// Row type enum for UI_Row.type (from row-content.spec.json).
public enum EVYRowType: String, Codable {
${rowEnumCases.join("\n")}
}
`;
}

/** Overrides: schema property -> Swift type (e.g. UI_Row.type -> EVYRowType). */
function buildShapeOverrides(): Map<string, string> {
	const m = new Map<string, string>();
	m.set("UI_Row.type", "EVYRowType");
	return m;
}

function collectRowAttributeEntries(rowSpec: RowSpec): [string, string][] {
	const entries = new Map<string, string>();
	for (const spec of Object.values(rowSpec)) {
		for (const [key, value] of Object.entries(
			withUniversalChildContent(spec.content),
		)) {
			entries.set(key, value);
		}
	}
	return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function swiftDefaultValueForSpecType(specType: string): string {
	switch (specType) {
		case "integer":
			return "0";
		case "[UI_Row]":
		case "[String]":
			return "[]";
		case "UI_Row":
			return "nil";
		default:
			return '""';
	}
}

/** Emit flattened UI_Row with defaults for optional row attributes. */
function emitUIRowClass(rowSpec: RowSpec): string {
	const entries = collectRowAttributeEntries(rowSpec);
	const attributeFields = entries.map(
		([key, value]) =>
			`    public let ${swiftIdentifier(key)}: ${swiftTypeForSpecType(value)}`,
	);
	const initParams = [
		"id: String",
		"type: EVYRowType",
		'source: String = ""',
		'destination: String = ""',
		"actions: [UI_RowAction] = []",
		'visible: String = ""',
		"name: String? = nil",
		...entries.map(
			([key, value]) =>
				`${swiftIdentifier(key)}: ${swiftTypeForSpecType(value)} = ${swiftDefaultValueForSpecType(value)}`,
		),
	];
	const attributeAssignments = entries.map(
		([key]) =>
			`        self.${swiftIdentifier(key)} = ${swiftIdentifier(key)}`,
	);
	const codingKeyCases = [
		"        case id",
		"        case type",
		"        case source",
		"        case destination",
		"        case actions",
		"        case visible",
		"        case name",
		...entries.map(([key]) => `        case ${swiftIdentifier(key)}`),
	];
	const decodeLines = entries.map(([key, value]) =>
		emitRowContentDecodeLine(key, value),
	);
	const encodeLines = entries.map(([key, value]) =>
		emitRowContentEncodeLine(key, value),
	);

	return `// MARK: - UI_Row
public final class UI_Row: Codable {
    public let id: String
    public let type: EVYRowType
    public let source: String
    public let destination: String
    public let actions: [UI_RowAction]
    public let visible: String
    public let name: String?
${attributeFields.join("\n")}

    public init(${initParams.join(", ")}) {
        self.id = id
        self.type = type
        self.source = source
        self.destination = destination
        self.actions = actions
        self.visible = visible
        self.name = name
${attributeAssignments.join("\n")}
    }

    private enum CodingKeys: String, CodingKey {
${codingKeyCases.join("\n")}
    }

    public required init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(EVYRowType.self, forKey: .type)
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? ""
        destination = try c.decodeIfPresent(String.self, forKey: .destination) ?? ""
        actions = try c.decodeIfPresent([UI_RowAction].self, forKey: .actions) ?? []
        visible = try c.decodeIfPresent(String.self, forKey: .visible) ?? ""
        name = try c.decodeIfPresent(String.self, forKey: .name)
${decodeLines.join("\n")}
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(source, forKey: .source)
        try c.encode(destination, forKey: .destination)
        try c.encode(actions, forKey: .actions)
        try c.encode(visible, forKey: .visible)
        try c.encodeIfPresent(name, forKey: .name)
${encodeLines.join("\n")}
    }
}
`;
}

function emitPropertyLine(
	defName: string,
	propName: string,
	propSchema: unknown,
	requiredKeys: string[],
	overrides: Map<string, string>,
): string {
	const { swiftType, isOptional } = swiftTypeForSchemaProp(
		propSchema,
		defName,
		propName,
		requiredKeys,
		overrides,
	);
	const optionalSuffix = isOptional ? "?" : "";
	return `    public let ${swiftIdentifier(propName)}: ${swiftType}${optionalSuffix}`;
}

/** Emit a single shape (struct or class) from a schema object. */
function emitShapeFromDef(
	defName: string,
	def: SchemaObject,
	overrides: Map<string, string>,
	rowSpec: RowSpec,
): string {
	const props = (def.properties ?? {}) as Record<string, unknown>;
	const required = (def.required ?? []) as string[];
	if (defName === "UI_Row") {
		return emitUIRowClass(rowSpec);
	}
	const lines: string[] = [];
	for (const [propName, propSchema] of Object.entries(props)) {
		lines.push(
			emitPropertyLine(
				defName,
				propName,
				propSchema,
				required,
				overrides,
			),
		);
	}
	const keyword = defName === "UI_Row" ? "final class" : "struct";
	const initParams = lines
		.map((l) => {
			const match = /public let (`?\w+`?): ([\w[\]?]+)/.exec(l);
			if (!match) return "";
			const name = match[1];
			const type = match[2];
			return `${name}: ${type}`;
		})
		.filter(Boolean);
	const initAssigns = lines
		.map((l) => {
			const match = /public let (`?\w+`?):/.exec(l);
			return match ? `        self.${match[1]} = ${match[1]}` : "";
		})
		.filter(Boolean);
	let initBlock = "";
	if (defName === "UI_Row" && initParams.length > 0) {
		initBlock = `

    public init(${initParams.join(", ")}) {
${initAssigns.join("\n")}
    }
`;
	}
	return `// MARK: - ${defName}
public ${keyword} ${defName}: Codable {
${lines.join("\n")}
${initBlock}
}
`;
}

function emitUIShapes(schema: SchemaObject, rowSpec: RowSpec): string {
	const overrides = buildShapeOverrides();
	const defs = (schema.$defs ?? {}) as Record<string, unknown>;

	// Root: UI_Flow
	const rootRequired = (schema.required ?? []) as string[];
	const rootProps = (schema.properties ?? {}) as Record<string, unknown>;
	const flowLines: string[] = [];
	for (const [propName, propSchema] of Object.entries(rootProps)) {
		flowLines.push(
			emitPropertyLine(
				"UI_Flow",
				propName,
				propSchema,
				rootRequired,
				overrides,
			),
		);
	}
	const flowBlock = `// MARK: - UI_Flow
public struct UI_Flow: Codable {
${flowLines.join("\n")}
}
`;

	// $defs in order: Page, Row, RowAction
	const defOrder = ["UI_Page", "UI_Row", "UI_RowAction"];
	const defBlocks: string[] = [];
	for (const name of defOrder) {
		const def = defs[name] as SchemaObject | undefined;
		if (!def) continue;
		defBlocks.push(emitShapeFromDef(name, def, overrides, rowSpec));
	}

	return `// Generated from types/schema/sdui/evy.schema.json - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.
// Depends on UIEnums.swift for EVYRowType.

import Foundation

${flowBlock}

${defBlocks.join("\n\n")}
`;
}

/** Decode line for one row-content spec field (non-optional Swift types; missing keys use defaults). */
function emitRowContentDecodeLine(key: string, specType: string): string {
	const k = swiftIdentifier(key);
	switch (specType) {
		case "string":
			return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k}) ?? ""`;
		case "[UI_Row]":
			return `        ${k} = try c.decodeIfPresent([UI_Row].self, forKey: .${k}) ?? []`;
		case "[String]":
			return `        ${k} = try c.decodeIfPresent([String].self, forKey: .${k}) ?? []`;
		case "integer":
			return `        ${k} = (try? c.decodeIfPresent(Int.self, forKey: .${k})) ?? Int((try? c.decodeIfPresent(String.self, forKey: .${k})) ?? "0") ?? 0`;
		case "UI_Row":
			return `        ${k} = try c.decodeIfPresent(UI_Row.self, forKey: .${k})`;
		default:
			return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k}) ?? ""`;
	}
}

function emitRowContentEncodeLine(key: string, specType: string): string {
	const k = swiftIdentifier(key);
	switch (specType) {
		case "integer":
			return `        try c.encode(${k}, forKey: .${k})`;
		case "UI_Row":
			return `        try c.encodeIfPresent(${k}, forKey: .${k})`;
		default:
			return `        try c.encode(${k}, forKey: .${k})`;
	}
}

function withUniversalChildContent(
	content: Record<string, string>,
): Record<string, string> {
	return {
		...content,
		child: content.child ?? "UI_Row",
	};
}

function emitRowViewDataStruct(
	rowType: string,
	spec: { content: Record<string, string> },
): string {
	const viewDataName = `${rowType}RowViewData`;
	const entries = Object.entries(withUniversalChildContent(spec.content));
	const fieldLines = entries.map(
		([key, value]) =>
			`    public let ${swiftIdentifier(key)}: ${swiftTypeForSpecType(value)}`,
	);
	const codingKeyCases = entries.map(
		([key]) => `        case ${swiftIdentifier(key)}`,
	);
	const decodeLines = entries.map(([key, value]) =>
		emitRowContentDecodeLine(key, value),
	);
	const encodeLines = entries.map(([key, value]) =>
		emitRowContentEncodeLine(key, value),
	);

	return `// MARK: - ${viewDataName}
public struct ${viewDataName}: Codable {
${fieldLines.join("\n")}

    private enum CodingKeys: String, CodingKey {
${codingKeyCases.join("\n")}
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
${decodeLines.join("\n")}
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
${encodeLines.join("\n")}
    }
}`;
}

function emitUIRowPayloads(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);

	const viewDataStructs: string[] = [];
	for (const rowType of rowTypes) {
		const spec = rowSpec[rowType];
		if (!spec) continue;
		viewDataStructs.push(emitRowViewDataStruct(rowType, spec));
	}

	const payloadCases: string[] = [];
	for (const rowType of rowTypes) {
		const spec = rowSpec[rowType];
		if (!spec) continue;
		const viewDataName = `${rowType}RowViewData`;
		payloadCases.push(
			`    case ${rowTypeToEnumCase(rowType)}(${viewDataName}, String, String, [UI_RowAction])`,
		);
	}

	const fromRowCases: string[] = [];
	for (const rowType of rowTypes) {
		const spec = rowSpec[rowType];
		if (!spec) continue;
		const viewDataName = `${rowType}RowViewData`;
		const enumCase = rowTypeToEnumCase(rowType);
		fromRowCases.push(`        case .${enumCase}:
            let viewData = try JSONDecoder().decode(${viewDataName}.self, from: JSONEncoder().encode(row))
            return .${enumCase}(viewData, row.source, row.destination, row.actions)`);
	}

	return `// Generated from types/schema/sdui/evy.schema.json + row-content.spec.json - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.

import Foundation

// MARK: - Per-row view data structs

${viewDataStructs.join("\n\n")}

// MARK: - UI_RowPayload

public enum UI_RowPayload {
${payloadCases.join("\n")}

    /// Build payload from a decoded UI_Row (e.g. from flow pages).
    public static func from(row: UI_Row) throws -> UI_RowPayload {
        switch row.type {
${fromRowCases.join("\n")}
        }
    }
}
`;
}

async function main(): Promise<void> {
	const schema = await loadJson<Record<string, unknown>>(UI_SCHEMA_PATH);
	const rowSpec = await loadJson<RowSpec>(ROW_SPEC_PATH);

	await writeFile(
		join(OUT_SWIFT, "UIEnums.swift"),
		emitUIEnums(rowSpec),
		"utf-8",
	);
	await writeFile(
		join(OUT_SWIFT, "UIShapes.swift"),
		emitUIShapes(schema, rowSpec),
		"utf-8",
	);
	await writeFile(
		join(OUT_SWIFT, "UIRowPayloads.swift"),
		emitUIRowPayloads(rowSpec),
		"utf-8",
	);

	console.log("Swift UI types generated successfully.");
}

runMain(main);
