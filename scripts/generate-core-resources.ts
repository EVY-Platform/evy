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
	generatedFileHeader,
	generatedSwiftHeader,
	loadJson,
	OUT_SWIFT,
	OUT_TS,
	resourceKey,
	runMain,
	SCHEMA_DIR,
	swiftCaseName,
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
	if (typeof obj.service !== "string" || obj.service.length === 0) {
		throw new Error(
			"core.resources.json: service must be a non-empty string",
		);
	}
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
	}
}

function generateTypeScript(schema: CoreResourcesSchema): string {
	const { service, resources } = schema;
	const resourceNames = Object.keys(resources);
	const lines: string[] = [];

	lines.push(...generatedFileHeader(CORE_RESOURCES_SCHEMA_PATH));
	lines.push(
		`export const EVY_CORE_SERVICE = ${JSON.stringify(service)} as const;`,
	);
	lines.push("");

	// Individual resource constants
	lines.push("export const EVY_CORE_RESOURCE = {");
	for (const [plural, meta] of Object.entries(resources)) {
		const key = resourceKey(plural);
		const singular = meta.singular;
		const comment =
			singular !== plural
				? ` // singular: ${JSON.stringify(singular)}`
				: "";
		lines.push(`\t${key}: ${JSON.stringify(plural)},${comment}`);
	}
	lines.push("} as const;");
	lines.push("");

	// Resource names tuple
	lines.push("export const EVY_CORE_RESOURCE_NAMES = [");
	for (const plural of resourceNames) {
		const key = resourceKey(plural);
		lines.push(`\tEVY_CORE_RESOURCE.${key},`);
	}
	lines.push("] as const;");
	lines.push("");

	// Type union
	lines.push(
		"export type EvyCoreResourceName = (typeof EVY_CORE_RESOURCE_NAMES)[number];",
	);
	lines.push("");

	// Set
	lines.push(
		"export const EVY_CORE_RESOURCE_NAME_SET: ReadonlySet<EvyCoreResourceName> =",
	);
	lines.push("\tnew Set(EVY_CORE_RESOURCE_NAMES);");
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
		const caseName = swiftCaseName(plural);
		lines.push(`\tcase ${caseName} = ${JSON.stringify(plural)}`);
	}
	lines.push("");

	// Singular lookup
	lines.push("\tpublic var singular: String {");
	lines.push("\t\tswitch self {");
	for (const [plural, meta] of Object.entries(resources)) {
		const caseName = swiftCaseName(plural);
		lines.push(
			`\t\tcase .${caseName}: return ${JSON.stringify(meta.singular)}`,
		);
	}
	lines.push("\t\t}");
	lines.push("\t}");
	lines.push("}");

	lines.push("");

	// All resource names (legacy compat / set-style access)
	lines.push(
		"public let EVY_CORE_RESOURCE_NAMES: Set<String> = Set(EVYCoreResource.allCases.map { $0.rawValue })",
	);
	lines.push("");

	return lines.join("\n");
}

async function main(): Promise<void> {
	const excludeIos = process.argv.includes("--exclude-ios");

	const schema = await loadJson<CoreResourcesSchema>(RESOURCES_SCHEMA_PATH);
	validateSchema(schema);

	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent: generateTypeScript(schema),
		swiftPath: OUT_SWIFT_PATH,
		swiftContent: generateSwift(schema),
		excludeIos,
	});
}

runMain(main);
