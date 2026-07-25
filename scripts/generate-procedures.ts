/**
 * Generate the RPC procedure registry from types/schema/resources/procedures.json.
 *
 * Outputs:
 *   types/generated/ts/procedures.ts — registry constants + metadata
 *
 * The registry is what makes a procedure callable: the gateway asserts its
 * handler set matches this file, and the builder reads result attributes from
 * it instead of importing response schemas one by one.
 *
 * Run: bun scripts/generate-procedures.ts
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	generatedFileHeader,
	loadJson,
	OUT_TS,
	resourceKey,
	runMain,
	SCHEMA_DIR,
} from "./types-generation-utils.js";

const PROCEDURES_SCHEMA_PATH = join(SCHEMA_DIR, "resources", "procedures.json");
const OUT_TS_PATH = join(OUT_TS, "procedures.ts");
const SOURCE_LABEL = "types/schema/resources/procedures.json";

interface RateLimitMeta {
	perMinute: number;
}

interface ProcedureMeta {
	service: string;
	request: string;
	response: string;
	rateLimit?: RateLimitMeta;
}

interface ProceduresSchema {
	procedures: Record<string, ProcedureMeta>;
}

/** The subset of JSON Schema this generator reads to derive result attributes. */
interface ResponseSchema {
	type?: string;
	items?: { properties?: Record<string, unknown> };
	properties?: Record<string, unknown>;
}

export function validateSchema(
	value: unknown,
): asserts value is ProceduresSchema {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${SOURCE_LABEL}: root must be an object`);
	}
	const procedures = (value as Record<string, unknown>).procedures;
	if (
		typeof procedures !== "object" ||
		procedures === null ||
		Array.isArray(procedures)
	) {
		throw new Error(`${SOURCE_LABEL}: procedures must be an object`);
	}
	const entries = Object.entries(procedures as Record<string, unknown>);
	if (entries.length === 0) {
		throw new Error(`${SOURCE_LABEL}: procedures must not be empty`);
	}
	for (const [name, meta] of entries) {
		if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
			throw new Error(
				`${SOURCE_LABEL}: procedures.${name} must be an object`,
			);
		}
		const m = meta as Record<string, unknown>;
		for (const field of ["service", "request", "response"] as const) {
			if (typeof m[field] !== "string" || m[field] === "") {
				throw new Error(
					`${SOURCE_LABEL}: procedures.${name}.${field} must be a non-empty string`,
				);
			}
		}
		if (m.rateLimit !== undefined) {
			const limit = m.rateLimit as Record<string, unknown>;
			if (
				typeof limit !== "object" ||
				limit === null ||
				typeof limit.perMinute !== "number" ||
				!Number.isInteger(limit.perMinute) ||
				limit.perMinute <= 0
			) {
				throw new Error(
					`${SOURCE_LABEL}: procedures.${name}.rateLimit.perMinute must be a positive integer`,
				);
			}
		}
	}
}

/**
 * Attribute names a client can bind to from a procedure's result.
 *
 * Only array-of-object responses have them - `place_search` returns rows the
 * builder offers as source attributes, whereas `sync` returns a envelope
 * nothing binds into. An empty list means "not a bindable source".
 */
export function resultAttributes(schema: ResponseSchema): string[] {
	if (schema.type === "array") {
		return Object.keys(schema.items?.properties ?? {});
	}
	return [];
}

function tsKey(name: string): string {
	return resourceKey(name);
}

export async function generateTypeScript(
	schema: ProceduresSchema,
	loadResponseSchema: (path: string) => Promise<ResponseSchema>,
): Promise<string> {
	const names = Object.keys(schema.procedures);
	const lines = generatedFileHeader(SOURCE_LABEL);

	lines.push("export const PROCEDURE = {");
	for (const name of names) {
		lines.push(`\t${tsKey(name)}: ${JSON.stringify(name)},`);
	}
	lines.push("} as const;");
	lines.push("");
	lines.push(
		"export type ProcedureName = (typeof PROCEDURE)[keyof typeof PROCEDURE];",
	);
	lines.push("");
	lines.push("export interface ProcedureMeta {");
	lines.push("\treadonly name: string;");
	lines.push(
		"\t/** Service that owns the procedure; others must forward. */",
	);
	lines.push("\treadonly service: string;");
	lines.push(
		"\t/** Calls allowed per socket per minute; absent means unlimited. */",
	);
	lines.push("\treadonly perMinute: number | null;");
	lines.push(
		"\t/** Bindable attribute names from the response; empty when not a bindable source. */",
	);
	lines.push("\treadonly resultAttributes: readonly string[];");
	lines.push("}");
	lines.push("");
	lines.push("export const PROCEDURES: Record<string, ProcedureMeta> = {");
	for (const name of names) {
		const meta = schema.procedures[name];
		const response = await loadResponseSchema(
			join(SCHEMA_DIR, meta.response),
		);
		const attributes = resultAttributes(response);
		lines.push(`\t${JSON.stringify(name)}: {`);
		lines.push(`\t\tname: ${JSON.stringify(name)},`);
		lines.push(`\t\tservice: ${JSON.stringify(meta.service)},`);
		lines.push(`\t\tperMinute: ${meta.rateLimit?.perMinute ?? "null"},`);
		lines.push(
			`\t\tresultAttributes: ${JSON.stringify(attributes)} as const,`,
		);
		lines.push("\t},");
	}
	lines.push("};");
	lines.push("");
	lines.push("export const PROCEDURE_NAMES: readonly string[] =");
	lines.push("\tObject.keys(PROCEDURES);");
	lines.push("");
	lines.push("/** Procedure names a given service owns. */");
	lines.push(
		"export function proceduresForService(service: string): string[] {",
	);
	lines.push("\treturn PROCEDURE_NAMES.filter(");
	lines.push("\t\t(name) => PROCEDURES[name].service === service,");
	lines.push("\t);");
	lines.push("}");
	lines.push("");
	lines.push(
		"/** Result attributes for a procedure, or an empty list when it has none. */",
	);
	lines.push(
		"export function procedureResultAttributes(name: string): readonly string[] {",
	);
	lines.push("\treturn PROCEDURES[name]?.resultAttributes ?? [];");
	lines.push("}");
	lines.push("");

	return lines.join("\n");
}

async function main(): Promise<void> {
	const schema = await loadJson<unknown>(PROCEDURES_SCHEMA_PATH);
	validateSchema(schema);

	const content = await generateTypeScript(schema, (path) =>
		loadJson<ResponseSchema>(path),
	);
	await mkdir(dirname(OUT_TS_PATH), { recursive: true });
	await writeFile(OUT_TS_PATH, content, "utf-8");
	console.log(`Generated ${OUT_TS_PATH}`);
}

if (import.meta.main) {
	runMain(main);
}
