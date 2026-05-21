/**
 * Generate platform-specific constants from types/schema/resources/core.resources.json.
 *
 * Outputs:
 *   types/generated/ts/coreResources.ts       — TypeScript constants
 *   types/generated/swift/CoreResources.generated.swift — Swift constants
 *
 * Run: bun scripts/generate-core-resources.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	OUT_SWIFT,
	OUT_TS,
	SCHEMA_DIR,
	loadJson,
	runMain,
} from "./types-generation-utils.js";

const RESOURCES_SCHEMA_PATH = join(
	SCHEMA_DIR,
	"resources",
	"core.resources.json",
);
const OUT_TS_PATH = join(OUT_TS, "coreResources.ts");
const OUT_SWIFT_PATH = join(OUT_SWIFT, "CoreResources.generated.swift");

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
		throw new Error("core.resources.json: service must be a non-empty string");
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

/** Convert a plural resource name like "organisations" to a constant key like "ORGANISATIONS". */
function resourceKey(plural: string): string {
	// Simple upper-snake-case from the plural string
	return plural.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/** Convert a plural resource name to a Swift enum case name (camelCase). */
function swiftCaseName(plural: string): string {
	// Convert "selling_reasons" -> "sellingReasons", "organisations" -> "organisations"
	const camel = plural.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
	// If it starts with a digit, prepend underscore
	if (/^\d/.test(camel)) {
		return `_${camel}`;
	}
	return camel;
}

function generateTypeScript(schema: CoreResourcesSchema): string {
	const { service, resources } = schema;
	const resourceNames = Object.keys(resources);
	const lines: string[] = [];

	lines.push("/* eslint-disable */");
	lines.push(
		`/** Generated from types/schema/resources/core.resources.json - do not edit. */`,
	);
	lines.push("");
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
			singular !== plural ? ` // singular: ${JSON.stringify(singular)}` : "";
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

	lines.push(
		"// Generated from types/schema/resources/core.resources.json - do not edit.",
	);
	lines.push("// Run `bun run types:generate` from repo root to regenerate.");
	lines.push("");

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
	const schema = await loadJson<CoreResourcesSchema>(RESOURCES_SCHEMA_PATH);
	validateSchema(schema);

	// TypeScript
	await mkdir(OUT_TS, { recursive: true });
	const tsContent = generateTypeScript(schema);
	await writeFile(OUT_TS_PATH, tsContent, "utf-8");
	console.log(`Generated ${OUT_TS_PATH}`);

	// Swift
	await mkdir(OUT_SWIFT, { recursive: true });
	const swiftContent = generateSwift(schema);
	await writeFile(OUT_SWIFT_PATH, swiftContent, "utf-8");
	console.log(`Generated ${OUT_SWIFT_PATH}`);
}

runMain(main);
