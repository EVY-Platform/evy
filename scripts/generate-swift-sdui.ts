import { join } from "node:path";
import {
	rowSpecFromDefinitions,
	type SduiRowDefinition,
	type SduiRowSpec,
	type SduiRowSpecField,
} from "./sdui-row-schema-utils.js";
import { OUT_SWIFT } from "./types-generation-utils.js";

type RowSpec = SduiRowSpec;

type SchemaObject = Record<string, unknown>;

type GeneratedSwiftFile = {
	path: string;
	content: string;
};

function swiftTypeForSpecType(s: string, required = true): string {
	switch (s) {
		case "string":
			return required ? "String" : "String?";
		case "integer":
			return required ? "Int" : "Int?";
		case "[UI_Row]":
			return required ? "[UI_Row]" : "[UI_Row]?";
		case "UI_Row":
			return "UI_Row?"; // always optional: single-row reference
		case "[String]":
			return required ? "[String]" : "[String]?";
		case "[UI_RowAction]":
			return required ? "[UI_RowAction]" : "[UI_RowAction]?";
		default:
			return required ? "String" : "String?";
	}
}

function rowTypeToEnumCase(rowType: string): string {
	const parts = rowType.split(/(?=[A-Z])/).map((part) => part.toLowerCase());
	return parts
		.map((part, index) =>
			index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join("");
}

function swiftIdentifier(name: string): string {
	return name === "true" || name === "false" ? `\`${name}\`` : name;
}

function getRowTypesFromSpec(rowSpec: RowSpec): string[] {
	return Object.keys(rowSpec).sort();
}

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
	const rowEnumCases = rowTypes.map(
		(rowType) => `    case ${rowTypeToEnumCase(rowType)} = "${rowType}"`,
	);
	return `// Generated from types/schema/sdui/definitions/ - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.

import Foundation

public enum EVYRowType: String, Codable {
${rowEnumCases.join("\n")}
}
`;
}

function buildShapeOverrides(): Map<string, string> {
	const overrides = new Map<string, string>();
	overrides.set("UI_Row.type", "EVYRowType");
	return overrides;
}

function collectRowAttributeEntries(rowSpec: RowSpec): [string, string][] {
	const entries = new Map<string, string>();
	for (const spec of Object.values(rowSpec)) {
		for (const [key, field] of Object.entries(spec.content)) {
			entries.set(key, field.type);
		}
	}
	return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function buildRowTypeAttributeKeys(rowSpec: RowSpec): Map<string, string[]> {
	const baseKeys = ["id", "type", "actions", "visible", "title", "name"];
	const map = new Map<string, string[]>();
	for (const [rowType, spec] of Object.entries(rowSpec)) {
		const keys = [
			...baseKeys,
			...Object.keys(spec.content).sort((a, b) => a.localeCompare(b)),
		];
		map.set(rowType, keys);
	}
	return map;
}

function emitUIRowEncodeSwitch(
	rowSpec: RowSpec,
	entries: [string, string][],
): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const typeAttributeKeys = buildRowTypeAttributeKeys(rowSpec);
	const cases = rowTypes.map((rowType) => {
		const allowed = new Set(typeAttributeKeys.get(rowType) ?? []);
		const contentEncodeLines = entries
			.filter(([key]) => allowed.has(key))
			.map(([key, specType]) => {
				const field = rowSpec[rowType]?.content[key];
				return emitRowContentEncodeLine(
					key,
					specType,
					field?.required ?? true,
				);
			});
		return `        case .${rowTypeToEnumCase(rowType)}:
${contentEncodeLines.join("\n")}`;
	});
	return `        switch type {
${cases.join("\n")}
        }`;
}

function swiftDefaultValueForSpecType(specType: string): string {
	switch (specType) {
		case "integer":
			return "0";
		case "[UI_Row]":
		case "[String]":
		case "[UI_RowAction]":
			return "[]";
		case "UI_Row":
			return "nil";
		default:
			return '""';
	}
}

function emitUIRowClass(rowSpec: RowSpec): string {
	const entries = collectRowAttributeEntries(rowSpec);
	const attributeFields = entries.map(
		([key, value]) =>
			`    public let ${swiftIdentifier(key)}: ${swiftTypeForSpecType(value)}`,
	);
	const initParams = [
		"id: String",
		"type: EVYRowType",
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
		"        case actions",
		"        case visible",
		"        case name",
		...entries.map(([key]) => `        case ${swiftIdentifier(key)}`),
	];
	const decodeLines = entries.map(([key, value]) =>
		emitRowContentDecodeLine(key, value),
	);
	const copyArgs = [
		"id: id",
		"type: type",
		"actions: actions",
		"visible: visible",
		"name: name",
		...entries.map(([key]) =>
			key === "title"
				? "title: title"
				: `${swiftIdentifier(key)}: ${swiftIdentifier(key)}`,
		),
	];
	const withTitleArgs = copyArgs
		.map((arg) => (arg === "title: title" ? "title: newTitle" : arg))
		.join(", ");
	return `// MARK: - UI_Row
public final class UI_Row: Codable {
    public let id: String
    public let type: EVYRowType
    public let actions: [UI_RowAction]
    public let visible: String
    public let name: String?
${attributeFields.join("\n")}

    public init(${initParams.join(", ")}) {
        self.id = id
        self.type = type
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
        actions = try c.decodeIfPresent([UI_RowAction].self, forKey: .actions) ?? []
        visible = try c.decodeIfPresent(String.self, forKey: .visible) ?? ""
        name = try c.decodeIfPresent(String.self, forKey: .name)
${decodeLines.join("\n")}
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(type, forKey: .type)
        try c.encode(actions, forKey: .actions)
        try c.encode(visible, forKey: .visible)
        try c.encodeIfPresent(name, forKey: .name)
${emitUIRowEncodeSwitch(rowSpec, entries)}
    }

    /// Copy of this row with a replaced title.
    public func with(title newTitle: String) -> UI_Row {
        UI_Row(${withTitleArgs})
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

function emitShapeFromDef(
	defName: string,
	def: SchemaObject,
	overrides: Map<string, string>,
): string {
	const props = (def.properties ?? {}) as Record<string, unknown>;
	const required = (def.required ?? []) as string[];
	const lines = Object.entries(props).map(([propName, propSchema]) =>
		emitPropertyLine(defName, propName, propSchema, required, overrides),
	);
	return `// MARK: - ${defName}
public struct ${defName}: Codable {
${lines.join("\n")}
}
`;
}

function emitUIShapes(
	schema: SchemaObject,
	actionSchema: SchemaObject,
	rowSpec: RowSpec,
): string {
	const overrides = buildShapeOverrides();
	const defs = (schema.$defs ?? {}) as Record<string, unknown>;
	const rootRequired = (schema.required ?? []) as string[];
	const rootProps = (schema.properties ?? {}) as Record<string, unknown>;
	const flowLines = Object.entries(rootProps).map(([propName, propSchema]) =>
		emitPropertyLine(
			"UI_Flow",
			propName,
			propSchema,
			rootRequired,
			overrides,
		),
	);
	const flowBlock = `// MARK: - UI_Flow
public struct UI_Flow: Codable {
${flowLines.join("\n")}
}
`;
	const defBlocks = [
		emitShapeFromDef("UI_Page", defs.UI_Page as SchemaObject, overrides),
		emitUIRowClass(rowSpec),
		emitShapeFromDef("UI_RowAction", actionSchema, overrides),
	];
	return `// Generated from types/schema/sdui/evy.schema.json + types/schema/sdui/definitions/ - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.

import Foundation

${flowBlock}

${defBlocks.join("\n\n")}
`;
}

function emitRowContentDecodeLine(
	key: string,
	specType: string,
	required = true,
	strict = false,
): string {
	const k = swiftIdentifier(key);
	if (!required) {
		// Optional fields: decodeIfPresent, nil when absent
		switch (specType) {
			case "[UI_Row]":
				return `        ${k} = try c.decodeIfPresent([UI_Row].self, forKey: .${k})`;
			case "[String]":
				return `        ${k} = try c.decodeIfPresent([String].self, forKey: .${k})`;
			case "[UI_RowAction]":
				return `        ${k} = try c.decodeIfPresent([UI_RowAction].self, forKey: .${k})`;
			case "integer":
				return `        ${k} = (try? c.decodeIfPresent(Int.self, forKey: .${k})) ?? Int((try? c.decodeIfPresent(String.self, forKey: .${k})) ?? "")`;
			case "UI_Row":
				return `        ${k} = try c.decodeIfPresent(UI_Row.self, forKey: .${k})`;
			default:
				return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k})`;
		}
	}
	if (strict) {
		// Required + strict: throws if the key is absent
		switch (specType) {
			case "string":
				return `        ${k} = try c.decode(String.self, forKey: .${k})`;
			case "[UI_Row]":
				return `        ${k} = try c.decode([UI_Row].self, forKey: .${k})`;
			case "[String]":
				return `        ${k} = try c.decode([String].self, forKey: .${k})`;
			case "[UI_RowAction]":
				return `        ${k} = try c.decode([UI_RowAction].self, forKey: .${k})`;
			case "integer":
				return `        ${k} = try c.decode(Int.self, forKey: .${k})`;
			case "UI_Row":
				// UI_Row references are always UI_Row? — keep lenient even when required
				return `        ${k} = try c.decodeIfPresent(UI_Row.self, forKey: .${k})`;
			default:
				return `        ${k} = try c.decode(String.self, forKey: .${k})`;
		}
	}
	// Required + lenient (mega-class union type): decodeIfPresent with a safe default
	switch (specType) {
		case "string":
			return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k}) ?? ""`;
		case "[UI_Row]":
			return `        ${k} = try c.decodeIfPresent([UI_Row].self, forKey: .${k}) ?? []`;
		case "[String]":
			return `        ${k} = try c.decodeIfPresent([String].self, forKey: .${k}) ?? []`;
		case "[UI_RowAction]":
			return `        ${k} = try c.decodeIfPresent([UI_RowAction].self, forKey: .${k}) ?? []`;
		case "integer":
			return `        ${k} = (try? c.decodeIfPresent(Int.self, forKey: .${k})) ?? Int((try? c.decodeIfPresent(String.self, forKey: .${k})) ?? "0") ?? 0`;
		case "UI_Row":
			return `        ${k} = try c.decodeIfPresent(UI_Row.self, forKey: .${k})`;
		default:
			return `        ${k} = try c.decodeIfPresent(String.self, forKey: .${k}) ?? ""`;
	}
}

function emitRowContentEncodeLine(
	key: string,
	specType: string,
	required = true,
): string {
	const k = swiftIdentifier(key);
	if (!required || specType === "UI_Row") {
		return `        try c.encodeIfPresent(${k}, forKey: .${k})`;
	}
	return `        try c.encode(${k}, forKey: .${k})`;
}

function emitRowViewDataStruct(
	rowType: string,
	spec: { content: Record<string, SduiRowSpecField> },
): string {
	const viewDataName = `${rowType}RowViewData`;
	const entries = Object.entries(spec.content);
	const fieldLines = entries.map(
		([key, field]) =>
			`    public let ${swiftIdentifier(key)}: ${swiftTypeForSpecType(field.type, field.required)}`,
	);
	// Synthesized Codable matches the strict hand-emitted coding exactly,
	// except optional integers, which decode leniently from Int or String.
	const needsCustomCoding = entries.some(
		([, field]) => field.type === "integer" && !field.required,
	);
	if (!needsCustomCoding) {
		return `// MARK: - ${viewDataName}
public struct ${viewDataName}: Codable {
${fieldLines.join("\n")}
}`;
	}
	const codingKeyCases = entries.map(
		([key]) => `        case ${swiftIdentifier(key)}`,
	);
	const decodeLines = entries.map(([key, field]) =>
		emitRowContentDecodeLine(key, field.type, field.required, true),
	);
	const encodeLines = entries.map(([key, field]) =>
		emitRowContentEncodeLine(key, field.type, field.required),
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

function emitRowAttributeProtocols(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const blocks: string[] = [];
	for (const rowType of rowTypes) {
		const spec = rowSpec[rowType];
		if (!spec) continue;
		const protocolName = `${rowType}RowAttributes`;
		const viewDataName = `${rowType}RowViewData`;
		const propLines = Object.entries(spec.content).map(
			([key, field]) =>
				`    var ${swiftIdentifier(key)}: ${swiftTypeForSpecType(field.type, field.required)} { get }`,
		);
		blocks.push(
			`public protocol ${protocolName} {\n${propLines.join("\n")}\n}\n\nextension ${viewDataName}: ${protocolName} {}`,
		);
	}
	return `// MARK: - Per-row attribute protocols\n\n${blocks.join("\n\n")}`;
}

function emitRowViewDataRegistry(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const decoderLines = rowTypes.map(
		(rowType) =>
			`        "${rowType}": { data in try JSONDecoder().decode(${rowType}RowViewData.self, from: data) }`,
	);
	return `// MARK: - SduiRowViewDataRegistry

public enum SduiRowViewDataRegistry {
    public static let decoders: [String: (Data) throws -> Any] = [
${decoderLines.join(",\n")}
    ]
}`;
}

function emitRowPayloadBindingAccessors(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const destinationCases = rowTypes.map((rowType) => {
		const enumCase = rowTypeToEnumCase(rowType);
		if (rowSpec[rowType]?.content.destination) {
			return `        case .${enumCase}(let view, _): return view.destination`;
		}
		return `        case .${enumCase}: return nil`;
	});
	return `extension UI_RowPayload {
    var destination: String? {
        switch self {
${destinationCases.join("\n")}
        }
    }
}`;
}

function emitUIRowPayloads(rowSpec: RowSpec): string {
	const rowTypes = getRowTypesFromSpec(rowSpec);
	const viewDataStructs = rowTypes.flatMap((rowType) => {
		const spec = rowSpec[rowType];
		return spec ? [emitRowViewDataStruct(rowType, spec)] : [];
	});
	const payloadCases = rowTypes.flatMap((rowType) => {
		const spec = rowSpec[rowType];
		if (!spec) return [];
		const viewDataName = `${rowType}RowViewData`;
		return [
			`    case ${rowTypeToEnumCase(rowType)}(${viewDataName}, [UI_RowAction])`,
		];
	});
	const fromRowCases = rowTypes.flatMap((rowType) => {
		const spec = rowSpec[rowType];
		if (!spec) return [];
		const viewDataName = `${rowType}RowViewData`;
		const enumCase = rowTypeToEnumCase(rowType);
		return [
			`        case .${enumCase}:
            let viewData = try JSONDecoder().decode(${viewDataName}.self, from: JSONEncoder().encode(row))
            return .${enumCase}(viewData, row.actions)`,
		];
	});
	const protocols = emitRowAttributeProtocols(rowSpec);
	const registry = emitRowViewDataRegistry(rowSpec);
	return `// Generated from types/schema/sdui/definitions/ - do not edit.
// Run \`bun run types:generate\` from repo root to regenerate.

import Foundation

// MARK: - Per-row view data structs

${viewDataStructs.join("\n\n")}

// MARK: - UI_RowPayload

public enum UI_RowPayload {
${payloadCases.join("\n")}

    public static func from(row: UI_Row) throws -> UI_RowPayload {
        switch row.type {
${fromRowCases.join("\n")}
        }
    }
}

${emitRowPayloadBindingAccessors(rowSpec)}

${protocols}

${registry}
`;
}

export function emitSwiftSdui({
	definitions,
	schema,
	actionSchema,
}: {
	definitions: SduiRowDefinition[];
	schema: SchemaObject;
	actionSchema: SchemaObject;
}): GeneratedSwiftFile[] {
	const rowSpec = rowSpecFromDefinitions(definitions);
	return [
		{
			path: join(OUT_SWIFT, "UIEnums.swift"),
			content: emitUIEnums(rowSpec),
		},
		{
			path: join(OUT_SWIFT, "UIShapes.swift"),
			content: emitUIShapes(schema, actionSchema, rowSpec),
		},
		{
			path: join(OUT_SWIFT, "UIRowPayloads.swift"),
			content: emitUIRowPayloads(rowSpec),
		},
	];
}
