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
	"marketplace.resources.json",
);
const OUT_TS_PATH = join(OUT_TS, "marketplaceResources.ts");
const OUT_SWIFT_PATH = join(OUT_SWIFT, "MarketplaceResources.generated.swift");
const MARKETPLACE_RESOURCES_SCHEMA_PATH =
	"types/schema/resources/marketplace.resources.json";

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
		throw new Error(
			"marketplace.resources.json: resources must be an object",
		);
	}
	for (const [name, id] of Object.entries(obj.resources)) {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error(
				`marketplace.resources.json: resources.${name} must be a non-empty string`,
			);
		}
	}
}

function generateTypeScript(schema: MarketplaceResourcesSchema): string {
	const { service, resources } = schema;
	const lines: string[] = [];

	lines.push(...generatedFileHeader(MARKETPLACE_RESOURCES_SCHEMA_PATH));
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

	return lines.join("\n");
}

function generateSwift(schema: MarketplaceResourcesSchema): string {
	const { service, resources } = schema;
	const lines: string[] = [];

	lines.push(...generatedSwiftHeader(MARKETPLACE_RESOURCES_SCHEMA_PATH));
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
	const schema = await loadJson<MarketplaceResourcesSchema>(
		RESOURCES_SCHEMA_PATH,
	);
	validateSchema(schema);

	await writeGeneratedOutputs({
		tsPath: OUT_TS_PATH,
		tsContent: generateTypeScript(schema),
		swiftPath: OUT_SWIFT_PATH,
		swiftContent: generateSwift(schema),
	});
}

runMain(main);
