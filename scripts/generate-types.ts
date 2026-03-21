import { compile } from "json-schema-to-typescript";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
	OUT_SWIFT,
	OUT_TS,
	REPO_ROOT,
	SCHEMA_DIR,
	TYPES_ROOT,
	appendLinesToGeneratedFile,
	loadJson,
	runMain,
	schemaPathToSwiftTypeName,
	schemaPathToTsName,
	spawnExitOk,
} from "./types-generation-utils.js";

const COMMON_SCHEMA_ROOT_REF: Record<string, string> = {
	"common/json": "#/$defs/JSONValue",
	"common/rpc": "#/$defs/IdFilter",
};

type LoadedSchemaFile = {
	schemaPath: string;
	schemaKey: string;
	schema: Record<string, unknown>;
};

async function findSchemaFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const out: string[] = [];
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) {
			out.push(...(await findSchemaFiles(full)));
		} else if (e.isFile() && e.name.endsWith(".schema.json")) {
			out.push(full);
		}
	}
	return out;
}

async function loadSchemaFiles(
	schemaPaths: string[],
): Promise<LoadedSchemaFile[]> {
	const loadedFiles: LoadedSchemaFile[] = [];
	for (const schemaPath of schemaPaths) {
		const schema = await loadJson<Record<string, unknown>>(schemaPath);
		loadedFiles.push({
			schemaPath,
			schemaKey: schemaPathToTsName(schemaPath),
			schema,
		});
	}
	return loadedFiles;
}

function buildSchemaWithRootRef(
	schema: Record<string, unknown>,
	rootRef: string,
): Record<string, unknown> {
	const { $defs, ...rest } = schema;
	return { ...rest, $ref: rootRef, $defs };
}

function getRootDefinition(
	schema: Record<string, unknown>,
	rootRef: string,
	schemaKey: string,
): Record<string, unknown> {
	const refName = rootRef.replace(/^#\/\$defs\//, "");
	const defs = schema.$defs as Record<string, unknown> | undefined;
	const rootDef = defs?.[refName] as Record<string, unknown> | undefined;
	if (!rootDef) {
		throw new Error(
			`Schema ${schemaKey}: $defs.${refName} not found for root $ref ${rootRef}`,
		);
	}
	return rootDef;
}

function inlineDefsRefs(
	obj: unknown,
	defsMap: Record<string, unknown>,
	expanding: Set<string> = new Set(),
): unknown {
	if (obj && typeof obj === "object" && !Array.isArray(obj)) {
		const o = obj as Record<string, unknown>;
		const ref = o.$ref as string | undefined;
		if (ref?.startsWith("#/$defs/")) {
			const name = ref.replace(/^#\/\$defs\//, "");
			if (expanding.has(name)) return obj;
			const d = defsMap[name];
			if (d === undefined) return obj;
			const next = new Set(expanding);
			next.add(name);
			return inlineDefsRefs(JSON.parse(JSON.stringify(d)), defsMap, next);
		}
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(o)) {
			out[k] = inlineDefsRefs(v, defsMap, expanding);
		}
		return out;
	}
	if (Array.isArray(obj))
		return obj.map((item) => inlineDefsRefs(item, defsMap, expanding));
	return obj;
}

/**
 * Detect whether a JSON schema references external files (non-local $ref).
 */
function hasExternalRefs(obj: unknown): boolean {
	if (obj && typeof obj === "object") {
		if (!Array.isArray(obj)) {
			const o = obj as Record<string, unknown>;
			if (typeof o.$ref === "string" && !o.$ref.startsWith("#")) return true;
			return Object.values(o).some(hasExternalRefs);
		}
		return obj.some(hasExternalRefs);
	}
	return false;
}

/**
 * json-schema-to-typescript inlines referenced schemas as exported interfaces,
 * causing duplicate exports across the barrel. For schemas with external $refs,
 * strip `export` from interfaces that aren't the schema's primary type so they
 * stay module-local.
 */
function unexportReferencedTypes(
	source: string,
	keepExported: Set<string>,
): string {
	return source.replace(
		/^export (interface|type) (\w+)/gm,
		(match, keyword, name) =>
			keepExported.has(name) ? match : `${keyword} ${name}`,
	);
}

async function generateTypeScript(
	schemaFiles: LoadedSchemaFile[],
): Promise<void> {
	const allSchemaTitles = new Set(
		schemaFiles.map(
			({ schemaPath, schema }) =>
				(schema.title as string | undefined) ??
				schemaPathToSwiftTypeName(schemaPath),
		),
	);

	await Promise.all(
		schemaFiles.map(async ({ schemaPath, schemaKey, schema }) => {
			const outRel = schemaPathToTsName(schemaPath) + ".ts";
			const outPath = join(OUT_TS, outRel);

			await mkdir(join(outPath, ".."), { recursive: true });

			let schemaForCompile = schema;
			let title =
				(schema.title as string | undefined) ??
				schemaPathToSwiftTypeName(schemaPath);

			const rootRef = COMMON_SCHEMA_ROOT_REF[schemaKey];
			if (rootRef) {
				const defs = (schema.$defs as Record<string, unknown>) ?? {};
				const rootDef = getRootDefinition(schema, rootRef, schemaKey);
				const expandedRoot = inlineDefsRefs(
					JSON.parse(JSON.stringify(rootDef)),
					defs,
				) as Record<string, unknown>;
				title = (schema.title as string | undefined) ?? "CommonJSON";
				schemaForCompile = {
					...schema,
					...expandedRoot,
					title,
					description: schema.description as string | undefined,
				};
			}
			const ts = await compile(schemaForCompile, title, {
				bannerComment: `/* eslint-disable */\n/** Generated from ${relative(TYPES_ROOT, schemaPath)} - do not edit. */`,
				declareExternallyReferenced: true,
				style: { singleQuote: false },
				cwd: join(schemaPath, ".."),
			});
			let output = ts;
			if (hasExternalRefs(schema)) {
				const ownDefs = new Set(
					Object.keys((schema.$defs as Record<string, unknown>) ?? {}),
				);
				ownDefs.add(title);
				for (const defName of ownDefs) {
					if (defName !== title && allSchemaTitles.has(defName)) {
						ownDefs.delete(defName);
					}
				}
				output = unexportReferencedTypes(ts, ownDefs);
			}
			await writeFile(outPath, output, "utf-8");

			if (schemaKey === "sdui/evy") {
				const rowDef = (schema.$defs as Record<string, unknown>)?.[
					"SDUI_Row"
				] as Record<string, unknown> | undefined;
				const rowTypeEnum = (rowDef?.properties as Record<string, unknown>)
					?.type as { enum?: string[] } | undefined;
				const rowValues = rowTypeEnum?.enum ?? [];
				await appendLinesToGeneratedFile(outPath, [
					`export const SDUI_ROW_TYPE_VALUES = ${JSON.stringify(rowValues)} as const;`,
				]);
			}
			if (schemaKey === "rpc/get.request") {
				const props = schema.properties as Record<string, { enum?: string[] }>;
				const namespaceValues = props?.namespace?.enum ?? [];
				const resourceValues = props?.resource?.enum ?? [];
				await appendLinesToGeneratedFile(outPath, [
					`export const NAMESPACE_VALUES = ${JSON.stringify(namespaceValues)} as const;`,
					`export const RESOURCE_VALUES = ${JSON.stringify(resourceValues)} as const;`,
				]);
			}
		}),
	);

	const lines: string[] = [];
	for (const { schemaPath: f, schemaKey, schema } of schemaFiles) {
		const rel = schemaPathToTsName(f);
		const mod = rel.replace(/\.ts$/, "");
		const title = (schema.title as string | undefined) ?? null;
		if (mod.startsWith("sdui/")) {
			lines.unshift(`export * from "./${mod}";`);
		} else if (mod.startsWith("data/")) {
			lines.unshift(`export * from "./${mod}";`);
		} else if (schemaKey === "rpc/get.request") {
			lines.push(
				`export type { GetRequest } from "./${mod}";`,
				`export { NAMESPACE_VALUES, RESOURCE_VALUES } from "./${mod}";`,
			);
		} else {
			const name = title ?? schemaPathToSwiftTypeName(f).replace(/^Rpc/, "");
			lines.push(`export type { ${name} } from "./${mod}";`);
		}
	}
	const content =
		lines.length > 0
			? lines.join("\n") + "\n"
			: "/** Generated types - add schemas in types/schema to generate. */\n";
	await writeFile(join(OUT_TS, "index.ts"), content, "utf-8");

	console.log("TypeScript types generated successfully.");
}

async function generateSwift(schemaFiles: LoadedSchemaFile[]): Promise<void> {
	await mkdir(OUT_SWIFT, { recursive: true });

	const schemaFilesToQuicktype = schemaFiles.filter(
		(f) =>
			f.schemaKey !== "sdui/evy" && // generated by generate-swift-sdui.ts
			f.schemaKey !== "rpc/get.response", // recursive $defs unsupported by quicktype
	);

	await Promise.all(
		schemaFilesToQuicktype.map(async ({ schemaPath, schemaKey, schema }) => {
			const typeName = schemaPathToSwiftTypeName(schemaPath);
			const outPath = join(OUT_SWIFT, `${typeName}.swift`);

			let inputPath = schemaPath;
			let tempPath: string | null = null;

			const rootRef = COMMON_SCHEMA_ROOT_REF[schemaKey];
			if (rootRef) {
				const withRef = buildSchemaWithRootRef(schema, rootRef);
				const safeSchemaKey = schemaKey.replace(/[/\\]/g, "-");
				tempPath = join(
					TYPES_ROOT,
					`.quicktype-${safeSchemaKey}-tmp.schema.json`,
				);
				await writeFile(tempPath, JSON.stringify(withRef), "utf-8");
				inputPath = tempPath;
			}

			try {
				await spawnExitOk(
					"bunx",
					[
						"quicktype",
						"--src-lang",
						"schema",
						"--lang",
						"swift",
						"-o",
						outPath,
						inputPath,
					],
					{ stdio: "inherit", cwd: REPO_ROOT },
					"quicktype",
				);
			} finally {
				if (tempPath) await rm(tempPath, { force: true });
			}
		}),
	);

	// Generate SDUI Swift from evy.schema.json + row-content.spec.json
	await spawnExitOk(
		"bun",
		["run", join(REPO_ROOT, "scripts", "generate-swift-sdui.ts")],
		{ stdio: "inherit", cwd: REPO_ROOT },
		"generate-swift-sdui",
	);

	console.log("Swift types generated successfully.");
}

/**
 * Main entry point for generating types.
 */
async function main(): Promise<void> {
	await rm(OUT_TS, { recursive: true, force: true });
	await rm(OUT_SWIFT, { recursive: true, force: true });
	await mkdir(OUT_TS, { recursive: true });
	await mkdir(OUT_SWIFT, { recursive: true });

	const schemaPaths = (await findSchemaFiles(SCHEMA_DIR)).sort();
	const schemaFiles = await loadSchemaFiles(schemaPaths);

	await Promise.all([
		generateTypeScript(schemaFiles),
		generateSwift(schemaFiles),
	]);
}

runMain(main);
