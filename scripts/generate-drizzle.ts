/**
 * Generate types/generated/ts/db/schema.generated.ts from types/schema/data/
 * (data.schema.json + drizzle.config.json). Config must only reference defs
 * and properties that exist in the schema (strict extension).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import decamelize from "decamelize";
import { z } from "zod";
import { TYPES_ROOT } from "./types-generation-utils.js";

const DATA_SCHEMA_PATH = join(TYPES_ROOT, "schema", "data", "data.schema.json");
const DRIZZLE_CONFIG_PATH = join(
	TYPES_ROOT,
	"schema",
	"data",
	"drizzle.config.json",
);
const OUT_PATH = join(
	TYPES_ROOT,
	"generated",
	"ts",
	"db",
	"schema.generated.ts",
);

const jsonSchemaPropSchema = z.looseObject({
	type: z.string().optional(),
	format: z.string().optional(),
	maxLength: z.number().optional(),
	$ref: z.string().optional(),
	default: z.unknown().optional(),
});

const jsonSchemaDefSchema = z.looseObject({
	type: z.string().optional(),
	properties: z.record(z.string(), jsonSchemaPropSchema).optional(),
	required: z.array(z.string()).optional(),
	enum: z.array(z.unknown()).optional(),
	$ref: z.string().optional(),
	additionalProperties: z.boolean().optional(),
});

const jsonSchemaSchema = z.object({
	$defs: z.record(z.string(), jsonSchemaDefSchema).optional(),
});

const drizzleEnumConfigSchema = z.object({
	name: z.string(),
	values: z.array(z.string()),
});

const drizzleTableConfigSchema = z.object({
	tableName: z.string(),
	primaryKey: z.string(),
	defaultRandom: z.array(z.string()),
	uniqueIndexes: z.array(
		z.object({
			name: z.string(),
			columns: z.array(z.string()),
		}),
	),
});

const drizzleConfigSchema = z.object({
	enums: z.record(z.string(), drizzleEnumConfigSchema).optional(),
	tables: z.record(z.string(), drizzleTableConfigSchema).optional(),
	relations: z
		.array(
			z.object({
				from: z.string(),
				to: z.string(),
				fields: z.array(z.string()).optional(),
				references: z.array(z.string()).optional(),
				relationName: z.string(),
				oneToMany: z.boolean().optional(),
			}),
		)
		.optional(),
});

type JsonSchema = z.infer<typeof jsonSchemaSchema>;
type DrizzleConfig = z.infer<typeof drizzleConfigSchema>;
type DrizzleTableConfig = z.infer<typeof drizzleTableConfigSchema>;
type DrizzleEnumConfig = z.infer<typeof drizzleEnumConfigSchema>;
type JsonSchemaProp = z.infer<typeof jsonSchemaPropSchema>;

function schemaPropertyKeys(def: {
	properties?: Record<string, JsonSchemaProp>;
}): Set<string> {
	return new Set(Object.keys(def.properties ?? {}));
}

function validateConfigSemantic(
	schema: JsonSchema,
	config: DrizzleConfig,
): void {
	const defs = schema.$defs ?? {};
	const tables = config.tables ?? {};
	for (const [tableKey, tableConfig] of Object.entries(tables) as [
		string,
		DrizzleTableConfig,
	][]) {
		const def = defs[tableKey];
		if (!def) {
			throw new Error(`drizzle.config.json: table "${tableKey}" is not a $def`);
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
	return tableName.charAt(0).toLowerCase() + tableName.slice(1);
}

function getPropSchema(
	def: { properties?: Record<string, JsonSchemaProp> },
	key: string,
): JsonSchemaProp | null {
	const p = def.properties?.[key];
	return typeof p === "object" && p !== null ? p : null;
}

function isRefToSduiFlow(prop: JsonSchemaProp): boolean {
	const ref = prop.$ref;
	return (
		typeof ref === "string" &&
		(ref.includes("SDUI_Flow") || ref.includes("evy.schema.json"))
	);
}

function isRefToOs(ref: string | undefined): boolean {
	return typeof ref === "string" && ref.includes("OS");
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
	if (format === "date-time") {
		return `timestamp("${dbCol}", { precision: 3 }).notNull()`;
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

function buildObjectColumn(
	dbCol: string,
	prop: JsonSchemaProp,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
): string {
	let col: string;
	if (isRefToSduiFlow(prop)) {
		col = `jsonb("${dbCol}").$type<SDUI_Flow>().notNull()`;
	} else {
		col = `jsonb("${dbCol}").$type<Record<string, unknown>>().notNull()`;
	}
	if (isPk) col += ".primaryKey()";
	if (hasDefaultRandom) col += ".defaultRandom()";
	return col;
}

function isRefToJsonValue(ref: string): boolean {
	return ref.includes("JSONValue") || ref.includes("json.schema.json");
}

function buildRefColumn(
	dbCol: string,
	ref: string,
	{ isPk, hasDefaultRandom }: ColumnSuffixes,
): string {
	if (isRefToOs(ref)) {
		return `osEnum("${dbCol}").notNull()`;
	}
	if (ref.includes("SDUI_Flow") || ref.includes("evy.schema.json")) {
		let col = `jsonb("${dbCol}").$type<SDUI_Flow>().notNull()`;
		if (isPk) col += ".primaryKey()";
		if (hasDefaultRandom) col += ".defaultRandom()";
		return col;
	}
	if (isRefToJsonValue(ref)) {
		let col = `jsonb("${dbCol}").$type<DATA_Data["data"]>().notNull()`;
		if (isPk) col += ".primaryKey()";
		if (hasDefaultRandom) col += ".defaultRandom()";
		return col;
	}
	return `jsonb("${dbCol}").$type<unknown>().notNull()`;
}

function applyNullabilityFallback(
	col: string,
	type: string | undefined,
	format: string | undefined,
	ref: string | undefined,
): string {
	if (
		col.includes(".notNull()") ||
		type === "boolean" ||
		col.includes("default")
	) {
		return col;
	}
	if (type === "string" && format !== "date-time") return col + ".notNull()";
	if (type === "object" || ref) return col;
	return col + ".notNull()";
}

/**
 * Emit a Drizzle column definition string from a JSON Schema property.
 * Rule order: string → boolean → object → $ref → fallback text.
 */
function emitColumn(
	defKey: string,
	propName: string,
	prop: JsonSchemaProp,
	tableConfig: { primaryKey: string; defaultRandom: string[] },
): string {
	const dbCol = decamelize(propName);
	const suffixes: ColumnSuffixes = {
		isPk: tableConfig.primaryKey === propName,
		hasDefaultRandom: tableConfig.defaultRandom.includes(propName),
	};
	const { type, format, maxLength, $ref: ref, default: defaultVal } = prop;

	let col: string;
	if (type === "string") {
		col = buildStringColumn(dbCol, format, maxLength, suffixes);
	} else if (type === "boolean") {
		col = buildBooleanColumn(dbCol, defaultVal);
	} else if (type === "object") {
		col = buildObjectColumn(dbCol, prop, suffixes);
	} else if (ref) {
		col = buildRefColumn(dbCol, ref, suffixes);
	} else {
		col = `text("${dbCol}")`;
	}

	return applyNullabilityFallback(col, type, format, ref);
}

async function main(): Promise<void> {
	const schemaRaw = await readFile(DATA_SCHEMA_PATH, "utf-8");
	const configRaw = await readFile(DRIZZLE_CONFIG_PATH, "utf-8");
	const schema = jsonSchemaSchema.parse(JSON.parse(schemaRaw) as unknown);
	const config = drizzleConfigSchema.parse(JSON.parse(configRaw) as unknown);

	validateConfigSemantic(schema, config);

	const defs = schema.$defs ?? {};
	const lines: string[] = [
		"/* eslint-disable */",
		"/** Generated from types/schema/data - do not edit. */",
		"",
		"import {",
		"	pgTable,",
		"	pgEnum,",
		"	uuid,",
		"	varchar,",
		"	text,",
		"	timestamp,",
		"	boolean,",
		"	jsonb,",
		"	uniqueIndex,",
		'} from "drizzle-orm/pg-core";',
		'import { relations } from "drizzle-orm";',
		'import type { SDUI_Flow } from "evy-types/sdui/evy";',
		'import type { DATA_Data } from "evy-types/data/data";',
		"",
	];

	for (const [enumKey, enumConfig] of Object.entries(config.enums ?? {}) as [
		string,
		DrizzleEnumConfig,
	][]) {
		lines.push(
			`export const osEnum = pgEnum("${enumConfig.name}", [${enumConfig.values.map((v) => `"${v}"`).join(", ")}]);`,
		);
		lines.push("");
	}

	const tableOrder = [
		"DATA_Device",
		"DATA_Service",
		"DATA_Organization",
		"DATA_ServiceProvider",
		"DATA_Flow",
		"DATA_Data",
	];

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
		const propEntries = Object.entries(def.properties);
		for (const [propName, propVal] of propEntries) {
			const prop = getPropSchema(def, propName);
			if (!prop) continue;
			const col = emitColumn(defKey, propName, prop, tableConfig);
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

	for (const rel of oneToManyRels) {
		const fromTable = config.tables?.[rel.from];
		const toTable = config.tables?.[rel.to];
		if (!fromTable || !toTable) continue;
		const fromVar = tableNameToVariable(fromTable.tableName);
		const toVar = tableNameToVariable(toTable.tableName);
		lines.push(
			`export const ${fromVar}Relations = relations(${fromVar}, ({ many }) => ({`,
		);
		lines.push(`	${rel.relationName}: many(${toVar}),`);
		lines.push("}));");
		lines.push("");
	}

	const serviceProviderRels = manyToOneRels.filter(
		(r) => r.from === "DATA_ServiceProvider",
	);
	if (serviceProviderRels.length > 0) {
		const fromTable = config.tables?.DATA_ServiceProvider;
		const toService = config.tables?.DATA_Service;
		const toOrg = config.tables?.DATA_Organization;
		if (fromTable && toService && toOrg) {
			lines.push(
				"export const serviceProviderRelations = relations(",
				"	serviceProvider,",
				"	({ one }) => ({",
			);
			const toServiceRel = serviceProviderRels.find(
				(r) => r.to === "DATA_Service",
			);
			const toOrgRel = serviceProviderRels.find(
				(r) => r.to === "DATA_Organization",
			);
			if (toServiceRel?.fields?.[0] && toServiceRel?.references?.[0]) {
				lines.push(
					"		service: one(service, {",
					`			fields: [serviceProvider.${toServiceRel.fields[0]}],`,
					`			references: [service.${toServiceRel.references[0]}],`,
					"		}),",
				);
			}
			if (toOrgRel?.fields?.[0] && toOrgRel?.references?.[0]) {
				lines.push(
					"		organization: one(organization, {",
					`			fields: [serviceProvider.${toOrgRel.fields[0]}],`,
					`			references: [organization.${toOrgRel.references[0]}],`,
					"		}),",
				);
			}
			lines.push("	}),");
			lines.push(");");
			lines.push("");
		}
	}

	await mkdir(dirname(OUT_PATH), { recursive: true });
	await writeFile(OUT_PATH, lines.join("\n"), "utf-8");

	console.log("Drizzle schema generated successfully.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
