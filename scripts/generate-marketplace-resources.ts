/**
 * Generate platform-specific constants from
 * types/schema/resources/marketplace.resources.json.
 *
 * Outputs:
 *   types/generated/ts/marketplaceResources.ts                 — TypeScript constants
 *   types/generated/swift/MarketplaceResources.generated.swift — Swift constants
 *
 * Run: bun scripts/generate-marketplace-resources.ts
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
	"marketplace.resources.json",
);
const OUT_TS_PATH = join(OUT_TS, "marketplaceResources.ts");
const OUT_SWIFT_PATH = join(OUT_SWIFT, "MarketplaceResources.generated.swift");

interface MarketplaceResourcesSchema {
	service: string;
	resources: Record<string, string>;
}

function validateSchema(
	value: unknown,
): asserts value is MarketplaceResourcesSchema {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("marketplace.resources.json: root must be an object");
	}
	const obj = value as Record<string, unknown>;
	if (typeof obj.service !== "string" || obj.service.length === 0) {
		throw new Error(
			"marketplace.resources.json: service must be a non-empty string",
		);
	}
	if (
		typeof obj.resources !== "object" ||
		obj.resources === null ||
		Array.isArray(obj.resources)
	) {
		throw new Error("marketplace.resources.json: resources must be an object");
	}
	for (const [name, id] of Object.entries(obj.resources)) {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error(
				`marketplace.resources.json: resources.${name} must be a non-empty string`,
			);
		}
	}
}

/** Convert a resource name like "selling_reasons" to an UPPER_SNAKE constant key. */
function resourceKey(name: string): string {
	return name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/** Convert a resource name to a Swift enum case name (camelCase). */
function swiftCaseName(name: string): string {
	const camel = name.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
	return /^\d/.test(camel) ? `_${camel}` : camel;
}

function generateTypeScript(schema: MarketplaceResourcesSchema): string {
	const { service, resources } = schema;
	const lines: string[] = [];

	lines.push("/* eslint-disable */");
	lines.push(
		"/** Generated from types/schema/resources/marketplace.resources.json - do not edit. */",
	);
	lines.push("");
	lines.push(
		`export const MARKETPLACE_SERVICE = ${JSON.stringify(service)} as const;`,
	);
	lines.push("");
	lines.push("export const MARKETPLACE_RESOURCE = {");
	for (const [name, id] of Object.entries(resources)) {
		lines.push(`\t${resourceKey(name)}: ${JSON.stringify(id)},`);
	}
	lines.push("} as const;");
	lines.push("");
	lines.push(
		"export type MarketplaceResourceId = (typeof MARKETPLACE_RESOURCE)[keyof typeof MARKETPLACE_RESOURCE];",
	);
	lines.push("");

	return lines.join("\n");
}

function generateSwift(schema: MarketplaceResourcesSchema): string {
	const { service, resources } = schema;
	const lines: string[] = [];

	lines.push(
		"// Generated from types/schema/resources/marketplace.resources.json - do not edit.",
	);
	lines.push("// Run `bun run types:generate` from repo root to regenerate.");
	lines.push("");
	lines.push(`public let MARKETPLACE_SERVICE = ${JSON.stringify(service)}`);
	lines.push("");
	lines.push("public enum MarketplaceResource: String, CaseIterable {");
	for (const [name, id] of Object.entries(resources)) {
		lines.push(`\tcase ${swiftCaseName(name)} = ${JSON.stringify(id)}`);
	}
	lines.push("}");
	lines.push("");

	return lines.join("\n");
}

async function main(): Promise<void> {
	const excludeIos = process.argv.includes("--exclude-ios");

	const schema = await loadJson<MarketplaceResourcesSchema>(
		RESOURCES_SCHEMA_PATH,
	);
	validateSchema(schema);

	await mkdir(OUT_TS, { recursive: true });
	await writeFile(OUT_TS_PATH, generateTypeScript(schema), "utf-8");
	console.log(`Generated ${OUT_TS_PATH}`);

	if (excludeIos) return;

	await mkdir(OUT_SWIFT, { recursive: true });
	await writeFile(OUT_SWIFT_PATH, generateSwift(schema), "utf-8");
	console.log(`Generated ${OUT_SWIFT_PATH}`);
}

runMain(main);
