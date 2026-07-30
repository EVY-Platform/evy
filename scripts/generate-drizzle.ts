/**
 * Generate types/generated/ts/db/schema.generated.ts from types/schema/data/
 * (data.schema.json + drizzle.config.json). Config must only reference defs
 * and properties that exist in the schema (strict extension).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
	loadJson,
	OUT_TS,
	runMain,
	SCHEMA_DIR,
} from "./types-generation-utils.js";

const DATA_SCHEMA_PATH = join(SCHEMA_DIR, "data", "data.schema.json");
const OS_SCHEMA_PATH = join(SCHEMA_DIR, "data", "os.schema.json");
const DRIZZLE_CONFIG_PATH = join(SCHEMA_DIR, "data", "drizzle.config.json");
const OUT_PATH = join(OUT_TS, "db", "schema.generated.ts");

interface JsonSchemaProp {
	type?: string;
	format?: string;
	maxLength?: number;
	$ref?: string;
	default?: unknown;
	items?: JsonSchemaProp;
}

interface JsonSchemaDef {
	type?: string;
	properties?: Record<string, JsonSchemaProp>;
	required?: string[];
	enum?: unknown[];
	$ref?: string;
	additionalProperties?: boolean;
}

export interface JsonSchema {
	$defs?: Record<string, JsonSchemaDef>;
}

/** Enum values come from data.schema.json $defs; config only maps the pg enum name. */
interface DrizzleEnumConfig {
	name: string;
}

interface DrizzleTableConfig {
	tableName: string;
	primaryKey: string;
	defaultRandom: string[];
	uniqueIndexes: { name: string; columns: string[] }[];
}

interface DrizzleRelation {
	from: string;
	to: string;
	fields?: string[];
	references?: string[];
	relationName: string;
	oneToMany?: boolean;
}

export interface DrizzleConfig {
	enums?: Record<string, DrizzleEnumConfig>;
	tables?: Record<string, DrizzleTableConfig>;
	relations?: DrizzleRelation[];
	/**
	 * `DATA_EVY_*` $defs that intentionally have no table (nested value objects
	 * embedded in another table's column). Listing one here is a deliberate
	 * opt-out; anything else without a table is treated as drift.
	 */
	nonTableDefs?: string[];
}

/** $defs matching this prefix are expected to be persisted as tables. */
const TABLE_DEF_PREFIX = "DATA_EVY_";

/** Minimal JSON shape so {@link validateConfigSemantic} can safely read `tables` / `relations`. */
function assertDrizzleConfigRoot(
	value: unknown,
): asserts value is Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("drizzle.config.json: root must be an object");
	}
}

export function assertDrizzleConfig(
	value: unknown,
): asserts value is DrizzleConfig {
	assertDrizzleConfigRoot(value);
	if (value.tables !== undefined) {
		if (
			typeof value.tables !== "object" ||
			value.tables === null ||
			Array.isArray(value.tables)
		) {
			throw new Error("drizzle.config.json: tables must be an object");
		}
		for (const [k, t] of Object.entries(value.tables)) {
			if (typeof t !== "object" || t === null || Array.isArray(t)) {
				throw new Error(
					`drizzle.config.json: tables.${k} must be an object`,
				);
			}
			const tb = t as Record<string, unknown>;
			for (const req of ["tableName", "primaryKey"] as const) {
				if (typeof tb[req] !== "string") {
					throw new Error(
						`drizzle.config.json: tables.${k}.${req} must be a string`,
					);
				}
			}
			if (!Array.isArray(tb.defaultRandom)) {
				throw new Error(
					`drizzle.config.json: tables.${k}.defaultRandom must be an array`,
				);
			}
			if (!Array.isArray(tb.uniqueIndexes)) {
				throw new Error(
					`drizzle.config.json: tables.${k}.uniqueIndexes must be an array`,
				);
			}
			for (const idx of tb.uniqueIndexes as unknown[]) {
				if (
					typeof idx !== "object" ||
					idx === null ||
					Array.isArray(idx)
				) {
					throw new Error(
						`drizzle.config.json: tables.${k}.uniqueIndexes entries must be objects`,
					);
				}
				const i = idx as Record<string, unknown>;
				if (typeof i.name !== "string") {
					throw new Error(
						`drizzle.config.json: tables.${k} uniqueIndex name must be a string`,
					);
				}
				if (!Array.isArray(i.columns)) {
					throw new Error(
						`drizzle.config.json: tables.${k} uniqueIndex columns must be an array`,
					);
				}
			}
		}
	}
	if (value.enums !== undefined) {
		if (
			typeof value.enums !== "object" ||
			value.enums === null ||
			Array.isArray(value.enums)
		) {
			throw new Error("drizzle.config.json: enums must be an object");
		}
		for (const [k, e] of Object.entries(value.enums)) {
			if (typeof e !== "object" || e === null || Array.isArray(e)) {
				throw new Error(
					`drizzle.config.json: enums.${k} must be an object`,
				);
			}
			const en = e as Record<string, unknown>;
			if (typeof en.name !== "string") {
				throw new Error(
					`drizzle.config.json: enums.${k} must have name (string)`,
				);
			}
		}
	}
	if (value.nonTableDefs !== undefined) {
		if (
			!Array.isArray(value.nonTableDefs) ||
			value.nonTableDefs.some((entry) => typeof entry !== "string")
		) {
			throw new Error(
				"drizzle.config.json: nonTableDefs must be an array of strings",
			);
		}
	}
	if (value.relations !== undefined) {
		if (!Array.isArray(value.relations)) {
			throw new Error("drizzle.config.json: relations must be an array");
		}
		for (const rel of value.relations as unknown[]) {
			if (typeof rel !== "object" || rel === null || Array.isArray(rel)) {
				throw new Error(
					"drizzle.config.json: relations entries must be objects",
				);
			}
			const r = rel as Record<string, unknown>;
			for (const req of ["from", "to", "relationName"] as const) {
				if (typeof r[req] !== "string") {
					throw new Error(
						`drizzle.config.json: each relation must have ${req} as a string`,
					);
				}
			}
		}
	}
}

function schemaPropertyKeys(def: {
	properties?: Record<string, JsonSchemaProp>;
}): Set<string> {
	return new Set(Object.keys(def.properties ?? {}));
}

/**
 * Catches the reverse of the checks below: a new `DATA_EVY_*` $def with no
 * table entry used to generate silently, leaving the type with nowhere to
 * persist. Opt a def out explicitly via `nonTableDefs`.
 */
export function validateEveryDataDefHasATable(
	schema: JsonSchema,
	config: DrizzleConfig,
): void {
	const tables = config.tables ?? {};
	const enums = config.enums ?? {};
	const exempt = new Set(config.nonTableDefs ?? []);

	const missing = Object.keys(schema.$defs ?? {}).filter(
		(defKey) =>
			defKey.startsWith(TABLE_DEF_PREFIX) &&
			!(defKey in tables) &&
			!(defKey in enums) &&
			!exempt.has(defKey),
	);

	if (missing.length > 0) {
		throw new Error(
			`drizzle.config.json: $def(s) ${missing
				.map((name) => `"${name}"`)
				.join(", ")} have no table entry. Add one, or list them in ` +
				`"nonTableDefs" if they are nested value objects with no table of their own.`,
		);
	}

	const unknownExempt = [...exempt].filter(
		(defKey) => !(defKey in (schema.$defs ?? {})),
	);
	if (unknownExempt.length > 0) {
		throw new Error(
			`drizzle.config.json: nonTableDefs ${unknownExempt
				.map((name) => `"${name}"`)
				.join(", ")} are not $defs in the schema`,
		);
	}
}

export function validateConfigSemantic(
	schema: JsonSchema,
	config: DrizzleConfig,
): void {
	const defs = schema.$defs ?? {};
	const tables = config.tables ?? {};
	validateEveryDataDefHasATable(schema, config);
	for (const [tableKey, tableConfig] of Object.entries(tables) as [
		string,
		DrizzleTableConfig,
	][]) {
		const def = defs[tableKey];
		if (!def) {
			throw new Error(
				`drizzle.config.json: table "${tableKey}" is not a $def`,
			);
		}
		const propKeys = schemaPropertyKeys(def);
		if (!propKeys.has(tableConfig.primaryKey)) {
			throw new Error(
				`drizzle.config.json: table "${tableKey}".primaryKey "${tableConfig.primaryKey}" is not a property of ${tableKey} in the schema`,
			);
		}
		for (const col of tableConfig.defaultRandom) {
			if (!propKeys.has(col)) {
				throw new Error(
					`drizzle.config.json: table "${tableKey}".defaultRandom "${col}" is not a property of ${tableKey} in the schema`,
				);
			}
		}
		for (const idx of tableConfig.uniqueIndexes) {
			for (const col of idx.columns) {
				if (!propKeys.has(col)) {
					throw new Error(
						`drizzle.config.json: table "${tableKey}" uniqueIndex "${idx.name}" column "${col}" is not a property of ${tableKey} in the schema`,
					);
				}
			}
		}
	}
	for (const rel of config.relations ?? []) {
		if (!(config.tables && rel.from in config.tables)) {
			throw new Error(
				`drizzle.config.json: relation from "${rel.from}" is not a table in config`,
			);
		}
		if (!(config.tables && rel.to in config.tables)) {
			throw new Error(
				`drizzle.config.json: relation to "${rel.to}" is not a table in config`,
			);
		}
		if (rel.oneToMany !== true && rel.fields) {
			const fromDef = defs[rel.from];
			if (fromDef) {
				const fromKeys = schemaPropertyKeys(fromDef);
				for (const f of rel.fields) {
					if (!fromKeys.has(f)) {
						throw new Error(
							`drizzle.config.json: relation from "${rel.from}" field "${f}" is not a property in the schema`,
						);
					}
				}
			}
			const toDef = defs[rel.to];
			if (toDef && rel.references) {
				const toKeys = schemaPropertyKeys(toDef);
				for (const r of rel.references) {
					if (!toKeys.has(r)) {
						throw new Error(
							`drizzle.config.json: relation to "${rel.to}" reference "${r}" is not a property in the schema`,
						);
					}
				}
			}
		}
	}
}

function tableNameToVariable(tableName: string): string {
	return tableName;
}

function getPropSchema(
	def: { properties?: Record<string, JsonSchemaProp> },
	key: string,
): JsonSchemaProp | null {
	const p = def.properties?.[key];
	return typeof p === "object" && p !== null ? p : null;
}

type ColumnSuffixes = { isPk: boolean; hasDefaultRandom: boolean };

function buildStringColumn(
	dbCol: string,
	format: string | undefined,
	maxLength: number | undefined,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
): string {
	if (format === "uuid") {
		let col = `uuid("${dbCol}")`;
		if (isPk) col += ".primaryKey()";
		if (hasDefaultRandom) col += ".defaultRandom()";
		return col;
	}
	/** JSON Schema `date-time`: store RFC 3339 / ISO 8601 strings in Postgres `text`, not `timestamp`. */
	if (format === "date-time") {
		return `text("${dbCol}").notNull()`;
	}
	if (typeof maxLength === "number") {
		let col = `varchar("${dbCol}", { length: ${maxLength} })`;
		if (isPk) col += ".primaryKey()";
		return col;
	}
	let col = `text("${dbCol}")`;
	if (isPk) col += ".primaryKey()";
	return col;
}

function buildBooleanColumn(dbCol: string, defaultVal: unknown): string {
	let col = `boolean("${dbCol}").notNull()`;
	if (defaultVal === false) col += ".default(false)";
	return col;
}

function buildIntegerColumn(
	dbCol: string,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
): string {
	let col = `integer("${dbCol}")`;
	if (isPk) col += ".primaryKey()";
	if (hasDefaultRandom) col += ".defaultRandom()";
	return col;
}

/** JSON Schema `number`: stored as Postgres `numeric` with JS number mode (decimals + integer literals). */
function buildNumberColumn(dbCol: string): string {
	return `numeric("${dbCol}", { precision: 28, scale: 10, mode: "number" })`;
}

/** `#/$defs/Foo` -> `Foo`, for local refs only. */
function localDefName(ref: string | undefined): string | null {
	const match = /^#\/\$defs\/([A-Za-z0-9_]+)$/.exec(ref ?? "");
	return match?.[1] ?? null;
}

export function resolveJsonbTypeAnnotation(ref: string | undefined): string {
	if (!ref) {
		throw new Error("resolveJsonbTypeAnnotation: ref is required");
	}
	switch (ref) {
		case "../sdui/evy.schema.json#/$defs/UI_Flow":
			return "UI_Flow";
		case "../common/json.schema.json#/$defs/JSONValue":
			return 'DATA_PRIMITIVE["data"]';
	}
	const local = localDefName(ref);
	if (local) {
		return local;
	}
	const externalMatch = /#\/\$defs\/([A-Za-z0-9_]+)$/.exec(ref);
	if (externalMatch?.[1]) {
		return externalMatch[1];
	}
	throw new Error(
		`resolveJsonbTypeAnnotation: unrecognised object $ref: ${ref}`,
	);
}

function buildArrayColumn(dbCol: string, prop: JsonSchemaProp): string {
	if (prop.items?.type === "string" && prop.items.format === "uuid") {
		return `jsonb("${dbCol}").$type<string[]>().notNull()`;
	}
	return `jsonb("${dbCol}").$type<unknown[]>().notNull()`;
}

function buildObjectColumn(
	dbCol: string,
	prop: JsonSchemaProp,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
): string {
	const typeArg = prop.$ref
		? resolveJsonbTypeAnnotation(prop.$ref)
		: "Record<string, unknown>";
	let col = `jsonb("${dbCol}").$type<${typeArg}>().notNull()`;
	if (isPk) col += ".primaryKey()";
	if (hasDefaultRandom) col += ".defaultRandom()";
	return col;
}

function enumKeyToConstName(enumKey: string): string {
	return `${enumKey}_enum`;
}

function buildRefColumn(
	dbCol: string,
	ref: string,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
	enumKeys: string[],
	defaultVal: unknown,
): string {
	for (const enumKey of enumKeys) {
		if (ref.includes(enumKey)) {
			const constName = enumKeyToConstName(enumKey);
			let col = `${constName}("${dbCol}").notNull()`;
			if (typeof defaultVal === "string") {
				col += `.default("${defaultVal}")`;
			}
			return col;
		}
	}
	const typeArg = resolveJsonbTypeAnnotation(ref);
	let col = `jsonb("${dbCol}").$type<${typeArg}>().notNull()`;
	if (isPk) col += ".primaryKey()";
	if (hasDefaultRandom) col += ".defaultRandom()";
	return col;
}

function applyNullabilityFallback(
	col: string,
	type: string | undefined,
	_format: string | undefined,
	ref: string | undefined,
	isRequired: boolean,
): string {
	if (!isRequired) {
		return col.replace(/\.notNull\(\)/g, "");
	}
	if (
		col.includes(".notNull()") ||
		type === "boolean" ||
		col.includes("default")
	) {
		return col;
	}
	return type === "object" || type === "array" || ref
		? col
		: `${col}.notNull()`;
}

/**
 * Emit a Drizzle column definition string from a JSON Schema property.
 * Rule order: string → integer → number → boolean → object → $ref → fallback text.
 */
let emitColumnEnumKeys: string[] = [];

function emitColumn(
	propName: string,
	prop: JsonSchemaProp,
	tableConfig: { primaryKey: string; defaultRandom: string[] },
	requiredSet: Set<string>,
): string {
	const dbCol = propName;
	const suffixes: ColumnSuffixes = {
		isPk: tableConfig.primaryKey === propName,
		hasDefaultRandom: tableConfig.defaultRandom.includes(propName),
	};
	const { type, format, maxLength, $ref: ref, default: defaultVal } = prop;
	const isRequired = requiredSet.has(propName);

	let col: string;
	if (type === "string") {
		col = buildStringColumn(dbCol, format, maxLength, suffixes);
	} else if (type === "integer") {
		col = buildIntegerColumn(dbCol, suffixes);
	} else if (type === "number") {
		col = buildNumberColumn(dbCol);
	} else if (type === "boolean") {
		col = buildBooleanColumn(dbCol, defaultVal);
	} else if (type === "array") {
		col = buildArrayColumn(dbCol, prop);
	} else if (type === "object") {
		col = buildObjectColumn(dbCol, prop, suffixes);
	} else if (ref) {
		col = buildRefColumn(
			dbCol,
			ref,
			suffixes,
			emitColumnEnumKeys,
			defaultVal,
		);
	} else {
		col = `text("${dbCol}")`;
	}

	return applyNullabilityFallback(col, type, format, ref, isRequired);
}

function isTypeUsed(typeName: string, columnLines: string[]): boolean {
	return columnLines.some((line) => line.includes(typeName));
}

async function main(): Promise<void> {
	const schemaRaw = await loadJson<unknown>(DATA_SCHEMA_PATH);
	const config = await loadJson<unknown>(DRIZZLE_CONFIG_PATH);
	assertDrizzleConfig(config);
	const schema = schemaRaw as JsonSchema;

	validateConfigSemantic(schema, config);

	const defs = schema.$defs ?? {};
	emitColumnEnumKeys = Object.keys(config.enums ?? {});
	// Emission order follows the config's key order (JSON preserves it).
	const tableOrder = Object.keys(config.tables ?? {});
	const hasNumberColumns = tableOrder.some((defKey) => {
		const tableConfig = config.tables?.[defKey];
		const def = defs[defKey];
		if (!tableConfig || !def?.properties) return false;
		return Object.values(def.properties).some(
			(prop) => prop.type === "number",
		);
	});
	const pgCoreImports = [
		"pgTable",
		"pgEnum",
		"uuid",
		"varchar",
		"text",
		"integer",
		...(hasNumberColumns ? ["numeric"] : []),
		"boolean",
		"jsonb",
		"uniqueIndex",
	];
	const lines: string[] = [];

	const osSchema = await loadJson<JsonSchemaDef>(OS_SCHEMA_PATH);
	for (const [enumKey, enumConfig] of Object.entries(config.enums ?? {})) {
		const enumDef = defs[enumKey];
		const values = (enumDef?.enum ?? []) as string[];
		if (values.length === 0) {
			throw new Error(
				`data.schema.json: $defs.${enumKey}.enum must define the ${enumConfig.name} values`,
			);
		}
		// os.schema.json declares the same enum standalone; fail on drift.
		if (
			enumKey === "OS" &&
			JSON.stringify(values) !== JSON.stringify(osSchema.enum ?? [])
		) {
			throw new Error(
				"data/os.schema.json enum does not match data.schema.json $defs.OS.enum",
			);
		}
		const constName = enumKeyToConstName(enumKey);
		lines.push(
			`export const ${constName} = pgEnum("${enumConfig.name}", [${values.map((v) => `"${v}"`).join(", ")}]);`,
		);
		lines.push("");
	}

	for (const defKey of tableOrder) {
		const tableConfig = config.tables?.[defKey];
		if (!tableConfig) continue;
		const def = defs[defKey];
		if (!def?.properties) continue;

		const varName = tableNameToVariable(tableConfig.tableName);
		lines.push(
			`export const ${varName} = pgTable(`,
			`	"${tableConfig.tableName}",`,
			"	{",
		);
		const requiredSet = new Set(def.required ?? []);
		for (const propName of Object.keys(def.properties)) {
			const prop = getPropSchema(def, propName);
			if (!prop) continue;
			const col = emitColumn(propName, prop, tableConfig, requiredSet);
			lines.push(`		${propName}: ${col},`);
		}
		lines.push("	},");

		if (tableConfig.uniqueIndexes.length > 0) {
			lines.push("	(table) => [");
			for (const idx of tableConfig.uniqueIndexes) {
				const onCols = idx.columns.map((c) => `table.${c}`).join(", ");
				lines.push(`		uniqueIndex("${idx.name}").on(${onCols}),`);
			}
			lines.push("	],");
		}
		lines.push(");");
		lines.push("");
	}

	const oneToManyRels = (config.relations ?? []).filter(
		(r) => r.oneToMany === true,
	);
	const manyToOneRels = (config.relations ?? []).filter(
		(r) => r.oneToMany !== true,
	);

	const oneToManyByFrom = new Map<string, typeof oneToManyRels>();
	for (const rel of oneToManyRels) {
		const list = oneToManyByFrom.get(rel.from) ?? [];
		list.push(rel);
		oneToManyByFrom.set(rel.from, list);
	}

	for (const [fromKey, rels] of oneToManyByFrom) {
		const fromTable = config.tables?.[fromKey];
		if (!fromTable) continue;
		const fromVar = tableNameToVariable(fromTable.tableName);
		lines.push(
			`export const ${fromVar}Relations = relations(${fromVar}, ({ many }) => ({`,
		);
		for (const rel of rels) {
			const toTable = config.tables?.[rel.to];
			if (!toTable) continue;
			const toVar = tableNameToVariable(toTable.tableName);
			lines.push(`	${rel.relationName}: many(${toVar}),`);
		}
		lines.push("}));");
		lines.push("");
	}

	const manyToOneByFrom = new Map<string, typeof manyToOneRels>();
	for (const rel of manyToOneRels) {
		const list = manyToOneByFrom.get(rel.from) ?? [];
		list.push(rel);
		manyToOneByFrom.set(rel.from, list);
	}

	for (const [fromKey, rels] of manyToOneByFrom) {
		const fromTable = config.tables?.[fromKey];
		if (!fromTable) continue;
		const fromVar = tableNameToVariable(fromTable.tableName);
		const exportName = `${fromVar}Relations`;
		const bodyLines: string[] = [];
		for (const rel of rels) {
			const toTable = config.tables?.[rel.to];
			const field = rel.fields?.[0];
			const reference = rel.references?.[0];
			if (!toTable || field === undefined || reference === undefined) {
				continue;
			}
			const toVar = tableNameToVariable(toTable.tableName);
			bodyLines.push(
				`		${rel.relationName}: one(${toVar}, {`,
				`			fields: [${fromVar}.${field}],`,
				`			references: [${toVar}.${reference}],`,
				"		}),",
			);
		}
		if (bodyLines.length === 0) continue;
		lines.push(`export const ${exportName} = relations(`);
		lines.push(`	${fromVar},`);
		lines.push("	({ one }) => ({");
		lines.push(...bodyLines);
		lines.push("	}),");
		lines.push(");");
		lines.push("");
	}

	await mkdir(dirname(OUT_PATH), { recursive: true });

	// Relative imports: this file lives inside evy-types, so importing the
	// package by name would depend on the consumer's own node_modules.
	// Local $defs referenced by jsonb columns all come from the generated data
	// types, so they are collected rather than listed one by one.
	const dataDefImports = Object.keys(schema.$defs ?? {})
		.filter((defName) =>
			// Exact `$type<Name>` match: a substring test would pull in
			// DATA_EVY_Flow just because DATA_EVY_FlowSubmits is used.
			lines.some((line) => line.includes(`$type<${defName}>`)),
		)
		.sort();
	const typeImports = [
		dataDefImports.length > 0
			? `import type { ${dataDefImports.join(", ")} } from "../data/data";`
			: null,
		isTypeUsed("UI_Flow", lines)
			? 'import type { UI_Flow } from "../sdui/evy";'
			: null,
		isTypeUsed("DATA_PRIMITIVE", lines)
			? 'import type { DATA_PRIMITIVE } from "../data/primitive";'
			: null,
	].filter((importLine) => importLine !== null);
	const headerLines = [
		"/* eslint-disable */",
		"/** Generated from types/schema/data - do not edit. */",
		"",
		"import {",
		...pgCoreImports.map((importName) => `\t${importName},`),
		'} from "drizzle-orm/pg-core";',
		'import { relations } from "drizzle-orm";',
		...typeImports,
		"",
	];

	await writeFile(OUT_PATH, [...headerLines, ...lines].join("\n"), "utf-8");

	console.log("Drizzle schema generated successfully.");
}

// Guarded so the validation helpers above can be imported by tests without
// kicking off a real generation run.
if (import.meta.main) {
	runMain(main);
}
