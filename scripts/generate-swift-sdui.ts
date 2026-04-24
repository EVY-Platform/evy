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
	OUT_SWIFT,
	SCHEMA_DIR,
	loadJson,
	runMain,
} from "./types-generation-utils.js";

const UI_SCHEMA_PATH = join(SCHEMA_DIR, "sdui", "evy.schema.json");
const ROW_SPEC_PATH = join(SCHEMA_DIR, "sdui", "row-content.spec.json");

type RowSpec = Record<
	string,
	{
		view?: Record<string, string>;
		content: Record<string, string>;
	}
>;

function swiftTypeForSpecType(s: string): string {
	switch (s) {
		case "string":
			return "String";
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

/** Known definition names that must be classes (recursive refs). */
const CLASS_DEFS = new Set(["UI_Row", "UI_RowView", "UI_RowContent"]);

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
	m.set("UI_Row.view", "UI_RowView");
	return m;
}

/** Emit property line(s) for one property. */
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
): string {
	const props = (def.properties ?? {}) as Record<string, unknown>;
	const required = (def.required ?? []) as string[];
	if (defName === "UI_Row") {
		return `// MARK: - UI_Row
public final class UI_Row: Codable {
    public let id: String
    public let type: EVYRowType
    public let view: UI_RowView
    public let source: String
    public let destination: String
    public let actions: [UI_RowAction]

    public init(id: String, type: EVYRowType, view: UI_RowView, source: String, destination: String, actions: [UI_RowAction]) {
        self.id = id
        self.type = type
        self.view = view
        self.source = source
        self.destination = destination
        self.actions = actions
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case view
        case source
        case destination
        case actions
    }

    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decode(EVYRowType.self, forKey: .type)
        view = try container.decode(UI_RowView.self, forKey: .view)
        source = try container.decode(String.self, forKey: .source)
        destination = try container.decodeIfPresent(String.self, forKey: .destination) ?? ""
        actions = try container.decodeIfPresent([UI_RowAction].self, forKey: .actions) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(view, forKey: .view)
        try container.encode(source, forKey: .source)
        try container.encode(destination, forKey: .destination)
        try container.encode(actions, forKey: .actions)
    }
}
`;
	}
	const lines: string[] = [];
	for (const [propName, propSchema] of Object.entries(props)) {
		lines.push(
			emitPropertyLine(defName, propName, propSchema, required, overrides),
		);
	}
	const useClass = CLASS_DEFS.has(defName);
	const useFinalClass = defName === "UI_Row";
	const keyword = useFinalClass ? "final class" : useClass ? "class" : "struct";
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
	if (useClass && initParams.length > 0) {
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

/** Emit UI_RowView from the inline view object under UI_Row. */
function emitRowViewFromSchema(
	schema: SchemaObject,
	overrides: Map<string, string>,
): string {
	const defs = schema.$defs as Record<string, unknown>;
	const rowDef = defs?.UI_Row as SchemaObject;
	const viewSchema = (rowDef?.properties as Record<string, unknown>)
		?.view as SchemaObject;
	const required = (viewSchema?.required ?? []) as string[];
	const props = (viewSchema?.properties ?? {}) as Record<string, unknown>;
	const lines: string[] = [];
	for (const [propName, propSchema] of Object.entries(props)) {
		const { swiftType, isOptional } = swiftTypeForSchemaProp(
			propSchema,
			"UI_RowView",
			propName,
			required,
			overrides,
		);
		lines.push(
			`    public let ${propName}: ${swiftType}${isOptional ? "?" : ""}`,
		);
	}
	return `// MARK: - UI_RowView (class to allow recursive reference)
public class UI_RowView: Codable {
${lines.join("\n")}
}
`;
}

/** Emit UI_RowContent with custom Codable for additionalProperties passthrough. */
function emitRowContentWithPassthrough(): string {
	return `// MARK: - UI_RowContent (preserves additional string keys so payload decode gets full content)
public class UI_RowContent: Codable {
    public let title: String
    public let children: [UI_Row]
    public let child: UI_Row?
    public let segments: [String]
    /// Additional content keys (e.g. label, value, placeholder) preserved for payload decoding.
    private let additional: [String: String]

    public init(title: String, children: [UI_Row] = [], child: UI_Row? = nil, segments: [String] = [], additional: [String: String] = [:]) {
        self.title = title
        self.children = children
        self.child = child
        self.segments = segments
        self.additional = additional
    }

    public required init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: UI_RowContentCodingKeys.self)
        title = try c.decode(String.self, forKey: .title)
        children = try c.decodeIfPresent([UI_Row].self, forKey: .children) ?? []
        child = try c.decodeIfPresent(UI_Row.self, forKey: .child)
        segments = try c.decodeIfPresent([String].self, forKey: .segments) ?? []
        let known = Set(["title", "children", "child", "segments"])
        var extra: [String: String] = [:]
        for key in c.allKeys {
            guard !known.contains(key.stringValue) else { continue }
            if let s = try? c.decode(String.self, forKey: key) {
                extra[key.stringValue] = s
            }
        }
        additional = extra
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: UI_RowContentCodingKeys.self)
        try c.encode(title, forKey: .title)
        try c.encode(children, forKey: .children)
        try c.encodeIfPresent(child, forKey: .child)
        try c.encode(segments, forKey: .segments)
        for (k, v) in additional {
            try c.encode(v, forKey: UI_RowContentCodingKeys(stringValue: k, intValue: nil)!)
        }
    }
}

private struct UI_RowContentCodingKeys: CodingKey {
    var stringValue: String
    var intValue: Int? { nil }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { nil }
    init?(stringValue: String, intValue: Int?) {
        self.stringValue = stringValue
    }
    static let title = UI_RowContentCodingKeys(stringValue: "title", intValue: nil)!
    static let children = UI_RowContentCodingKeys(stringValue: "children", intValue: nil)!
    static let child = UI_RowContentCodingKeys(stringValue: "child", intValue: nil)!
    static let segments = UI_RowContentCodingKeys(stringValue: "segments", intValue: nil)!
}
`;
}

function emitUIShapes(schema: SchemaObject): string {
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

	// $defs in order: Page, Row, RowView (synthetic), RowContent (custom), RowAction
	const defOrder = [
		"UI_Page",
		"UI_Row",
		"UI_RowView",
		"UI_RowContent",
		"UI_RowAction",
	];
	const defBlocks: string[] = [];
	for (const name of defOrder) {
		if (name === "UI_RowView") {
			defBlocks.push(emitRowViewFromSchema(schema, overrides));
			continue;
		}
		if (name === "UI_RowContent") {
			defBlocks.push(emitRowContentWithPassthrough());
			continue;
		}
		const def = defs[name] as SchemaObject | undefined;
		if (!def) continue;
		defBlocks.push(emitShapeFromDef(name, def, overrides));
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
		case "UI_Row":
			return `        ${k} = try c.decodeIfPresent(UI_Row.self, forKey: .${k})`;
		default:
			return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k}) ?? ""`;
	}
}

function emitRowContentEncodeLine(key: string, specType: string): string {
	const k = swiftIdentifier(key);
	switch (specType) {
		case "UI_Row":
			return `        try c.encodeIfPresent(${k}, forKey: .${k})`;
		default:
			return `        try c.encode(${k}, forKey: .${k})`;
	}
}

function emitRowContentStruct(
	rowType: string,
	content: Record<string, string>,
): string {
	const contentName = `${rowType}RowContent`;
	const entries = Object.entries(content);
	const fieldLines = entries.map(
		([k, v]) =>
			`    public let ${swiftIdentifier(k)}: ${swiftTypeForSpecType(v)}`,
	);
	const codingKeyCases = entries.map(
		([k]) => `        case ${swiftIdentifier(k)}`,
	);
	const decodeLines = entries.map(([k, v]) => emitRowContentDecodeLine(k, v));
	const encodeLines = entries.map(([k, v]) => emitRowContentEncodeLine(k, v));

	return `// MARK: - ${contentName}
public struct ${contentName}: Codable {
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

function emitRowViewDataStruct(
	rowType: string,
	spec: { view?: Record<string, string> },
): string {
	const viewDataName = `${rowType}RowViewData`;
	const contentName = `${rowType}RowContent`;

	if (!spec.view || Object.keys(spec.view).length === 0) {
		return `// MARK: - ${viewDataName}
public struct ${viewDataName}: Codable {
    public let content: ${contentName}
}`;
	}

	const viewEntries = Object.entries(spec.view);
	const viewFieldLines = viewEntries.map(
		([k]) => `    public let ${swiftIdentifier(k)}: String`,
	);
	const codingKeyCases = [
		"        case content",
		...viewEntries.map(([k]) => `        case ${swiftIdentifier(k)}`),
	];
	const decodeViewLines = viewEntries.map(
		([k]) =>
			`        ${swiftIdentifier(k)} = try c.decodeIfPresent(String.self, forKey: .${swiftIdentifier(k)}) ?? ""`,
	);
	const encodeViewLines = viewEntries.map(
		([k]) =>
			`        try c.encode(${swiftIdentifier(k)}, forKey: .${swiftIdentifier(k)})`,
	);

	return `// MARK: - ${viewDataName}
public struct ${viewDataName}: Codable {
    public let content: ${contentName}
${viewFieldLines.join("\n")}

    private enum CodingKeys: String, CodingKey {
${codingKeyCases.join("\n")}
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        content = try c.decode(${contentName}.self, forKey: .content)
${decodeViewLines.join("\n")}
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(content, forKey: .content)
${encodeViewLines.join("\n")}
    }
}`;
}

function emitUIRowPayloads(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);

	const contentStructs: string[] = [];
	const viewDataStructs: string[] = [];
	for (const rowType of rowTypes) {
		const spec = rowSpec[rowType];
		if (!spec) continue;
		contentStructs.push(emitRowContentStruct(rowType, spec.content));
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
            let viewData = try JSONDecoder().decode(${viewDataName}.self, from: JSONEncoder().encode(row.view))
            return .${enumCase}(viewData, row.source, row.destination, row.actions)`);
	}

	return `// Generated from types/schema/sdui/evy.schema.json + row-content.spec.json - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.

import Foundation

// MARK: - Per-row content and view data structs

${contentStructs.join("\n\n")}

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
		emitUIShapes(schema),
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
