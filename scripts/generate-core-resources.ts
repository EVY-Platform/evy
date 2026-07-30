/**
 * Generate platform-specific constants from types/schema/resources/core.resources.json.
 *
 * Outputs:
 *   types/generated/ts/coreResources.ts       — TypeScript constants
 *   types/generated/swift/CoreResources.generated.swift — Swift constants
 *
 * Run: bun scripts/generate-core-resources.ts
 */

import { join } from "node:path";
import {
	assertValidServiceSlug,
	formatResourceRef,
} from "../types/resourceRef.js";
import {
	generatedFileHeader,
	generatedSwiftHeader,
	loadJson,
	OUT_SWIFT,
	OUT_TS,
	resourceKey,
	runMain,
	SCHEMA_DIR,
	snakeToCamel,
	writeGeneratedOutputs,
} from "./types-generation-utils.js";

const RESOURCES_SCHEMA_PATH = join(
	SCHEMA_DIR,
	"resources",
	"core.resources.json",
);
const OUT_TS_PATH = join(OUT_TS, "coreResources.ts");
const OUT_SWIFT_PATH = join(OUT_SWIFT, "CoreResources.generated.swift");
const CORE_RESOURCES_SCHEMA_PATH = "types/schema/resources/core.resources.json";

interface ResourceMeta {
	singular: string;
	visibility?: "public" | "private";
	dataValues?: string[];
}

interface CoreResourcesSchema {
	service: string;
	resources: Record<string, ResourceMeta>;
}

function validateSchema(value: unknown): asserts value is CoreResourcesSchema {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("core.resources.json: root must be an object");
	}
	const obj = value as Record<string, unknown>;
	if (typeof obj.service !== "string") {
		throw new Error(
			"core.resources.json: service must be a valid service slug",
		);
	}
	assertValidServiceSlug(obj.service);
	if (
		typeof obj.resources !== "object" ||
		obj.resources === null ||
		Array.isArray(obj.resources)
	) {
		throw new Error("core.resources.json: resources must be an object");
	}
	const resources = obj.resources as Record<string, unknown>;
	for (const [name, meta] of Object.entries(resources)) {
		if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
			throw new Error(
				`core.resources.json: resources.${name} must be an object`,
			);
		}
		const m = meta as Record<string, unknown>;
		if (typeof m.singular !== "string" || m.singular.length === 0) {
			throw new Error(
				`core.resources.json: resources.${name}.singular must be a non-empty string`,
			);
		}
		if (
			m.visibility !== undefined &&
			m.visibility !== "public" &&
			m.visibility !== "private"
		) {
			throw new Error(
				`core.resources.json: resources.${name}.visibility must be "public" or "private" when set`,
			);
		}
		if (m.dataValues !== undefined) {
			if (!Array.isArray(m.dataValues) || m.dataValues.length === 0) {
				throw new Error(
					`core.resources.json: resources.${name}.dataValues must be a non-empty string array when set`,
				);
			}
			for (const value of m.dataValues) {
				if (typeof value !== "string" || value.length === 0) {
					throw new Error(
						`core.resources.json: resources.${name}.dataValues entries must be non-empty strings`,
					);
				}
			}
		}
	}
}

function generateTypeScript(schema: CoreResourcesSchema): string {
	const { service, resources } = schema;
	const lines: string[] = [];

	lines.push(...generatedFileHeader(CORE_RESOURCES_SCHEMA_PATH));
	lines.push(
		`export const EVY_CORE_SERVICE = ${JSON.stringify(service)} as const;`,
	);
	lines.push("");

	lines.push("export const EVY_CORE_RESOURCE_REF = {");
	for (const [plural] of Object.entries(resources)) {
		const key = resourceKey(plural);
		lines.push(
			`\t${key}: ${JSON.stringify(formatResourceRef(service, plural))},`,
		);
	}
	lines.push("} as const;");
	lines.push("");

	lines.push("export const EVY_CORE_RESOURCES = [");
	for (const [plural, meta] of Object.entries(resources)) {
		lines.push(
			`\t{ id: ${JSON.stringify(formatResourceRef(service, plural))}, name: ${JSON.stringify(meta.singular)} },`,
		);
	}
	lines.push("] as const;");
	lines.push("");

	// Visibility every record of a resource is created with. Resources with no
	// visibility field of their own are absent.
	lines.push("export const EVY_CORE_RESOURCE_VISIBILITY: Readonly<");
	lines.push('\tRecord<string, "public" | "private">');
	lines.push("> = {");
	for (const [plural, meta] of Object.entries(resources)) {
		if (!meta.visibility) continue;
		lines.push(
			`\t${JSON.stringify(plural)}: ${JSON.stringify(meta.visibility)},`,
		);
	}
	lines.push("};");
	lines.push("");

	const messageDataValues = resources.messages?.dataValues ?? [];
	lines.push(
		"export const EVY_MESSAGE_DATA_VALUES =",
		`${JSON.stringify(messageDataValues)} as const;`,
	);
	lines.push("");

	return lines.join("\n");
}

function generateSwift(schema: CoreResourcesSchema): string {
	const { service, resources } = schema;
	const resourceNames = Object.keys(resources);
	const lines: string[] = [];

	lines.push(...generatedSwiftHeader(CORE_RESOURCES_SCHEMA_PATH));

	// Service name
	lines.push(`public let EVY_CORE_SERVICE = ${JSON.stringify(service)}`);
	lines.push("");

	// Resource enum
	lines.push("public enum EVYCoreResource: String, CaseIterable {");
	for (const plural of resourceNames) {
		const caseName = snakeToCamel(plural);
		lines.push(`\tcase ${caseName} = ${JSON.stringify(plural)}`);
	}
	lines.push("");

	// Singular lookup
	lines.push("\tpublic var singular: String {");
	lines.push("\t\tswitch self {");
	for (const [plural, meta] of Object.entries(resources)) {
		const caseName = snakeToCamel(plural);
		lines.push(
			`\t\tcase .${caseName}: return ${JSON.stringify(meta.singular)}`,
		);
	}
	lines.push("\t\t}");
	lines.push("\t}");
	lines.push("");

	// Visibility lookup
	lines.push(
		"\t/// The visibility every record of this resource is created with.",
	);
	lines.push(
		"\t/// Nil for resources with no visibility field of their own.",
	);
	lines.push("\tpublic var visibility: String? {");
	lines.push("\t\tswitch self {");
	for (const [plural, meta] of Object.entries(resources)) {
		const caseName = snakeToCamel(plural);
		const value = meta.visibility ? JSON.stringify(meta.visibility) : "nil";
		lines.push(`\t\tcase .${caseName}: return ${value}`);
	}
	lines.push("\t\t}");
	lines.push("\t}");
	lines.push("");

	lines.push("\tpublic var ref: String {");
	lines.push('\t\t"\\(EVY_CORE_SERVICE).\\(rawValue)"');
	lines.push("\t}");
	lines.push("}");

	lines.push("");

	// All resource names (set-style access)
	lines.push(
		"public let EVY_CORE_RESOURCE_NAMES: Set<String> = Set(EVYCoreResource.allCases.map { $0.rawValue })",
	);
	lines.push("");

	return lines.join("\n");
}

async function main(): Promise<void> {
	const schema = await loadJson<CoreResourcesSchema>(RESOURCES_SCHEMA_PATH);
	validateSchema(schema);

	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent: generateTypeScript(schema),
		swiftPath: OUT_SWIFT_PATH,
		swiftContent: generateSwift(schema),
	});
}

runMain(main);
