import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { compile } from "json-schema-to-typescript";
import { generateSduiDefinitions } from "./generate-sdui-definitions.js";
import { emitSwiftSdui } from "./generate-swift-sdui.js";
import { loadSduiRowDefinitions } from "./sdui-row-schema-utils.js";
import {
	loadJson,
	OUT_SWIFT,
	OUT_TS,
	REPO_ROOT,
	runMain,
	SCHEMA_DIR,
	schemaPathToTsName,
	schemaPathToTypeName,
	spawnExitOk,
	TYPES_ROOT,
} from "./types-generation-utils.js";

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

/**
 * Detect whether a JSON schema references external files (non-local $ref).
 */
function hasExternalRefs(obj: unknown): boolean {
	if (obj && typeof obj === "object") {
		if (!Array.isArray(obj)) {
			const o = obj as Record<string, unknown>;
			if (typeof o.$ref === "string" && !o.$ref.startsWith("#"))
				return true;
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

/**
 * Schemas that never become standalone TypeScript modules: the SDUI row
 * definitions are already inlined into sdui/evy's UI_Row union, the
 * definition meta-schema is generator-time validation only, and common/*
 * are only $ref'd by other schemas on disk (both compilers resolve them
 * without a standalone module). None of their would-be exports have
 * consumers.
 */
function isTsEmittedSchema(schemaKey: string): boolean {
	return (
		schemaKey !== "sdui/definition" &&
		!schemaKey.startsWith("sdui/definitions/") &&
		!schemaKey.startsWith("common/")
	);
}

async function generateTypeScript(
	schemaFiles: LoadedSchemaFile[],
): Promise<void> {
	const allSchemaTitles = new Set(
		schemaFiles.map(
			({ schemaPath, schema }) =>
				(schema.title as string | undefined) ??
				schemaPathToTypeName(schemaPath),
		),
	);
	const tsSchemaFiles = schemaFiles.filter(({ schemaKey }) =>
		isTsEmittedSchema(schemaKey),
	);

	await Promise.all(
		tsSchemaFiles.map(async ({ schemaPath, schema }) => {
			const outRel = `${schemaPathToTsName(schemaPath)}.ts`;
			const outPath = join(OUT_TS, outRel);

			await mkdir(dirname(outPath), { recursive: true });

			const title =
				(schema.title as string | undefined) ??
				schemaPathToTypeName(schemaPath);

			const ts = await compile(schema, title, {
				bannerComment: `/* eslint-disable */\n/** Generated from ${relative(TYPES_ROOT, schemaPath)} - do not edit. */`,
				declareExternallyReferenced: true,
				style: { singleQuote: false },
				cwd: join(schemaPath, ".."),
			});
			let output = ts;
			if (hasExternalRefs(schema)) {
				const ownDefs = new Set(
					Object.keys(
						(schema.$defs as Record<string, unknown>) ?? {},
					),
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
		}),
	);

	const lines: string[] = [];
	for (const { schemaPath: f, schema } of tsSchemaFiles) {
		const rel = schemaPathToTsName(f);
		const mod = rel.replace(/\.ts$/, "");
		const title = (schema.title as string | undefined) ?? null;
		if (
			mod.startsWith("sdui/") ||
			mod.startsWith("files/") ||
			mod.startsWith("data/")
		) {
			lines.unshift(`export * from "./${mod}";`);
		} else {
			const name = title ?? schemaPathToTypeName(f).replace(/^Rpc/, "");
			lines.push(`export type { ${name} } from "./${mod}";`);
		}
	}
	lines.unshift('export * from "./sdui/definitions.generated";');
	const content =
		lines.length > 0
			? `${lines.join("\n")}\n`
			: "/** Generated types - add schemas in types/schema to generate. */\n";
	await writeFile(join(OUT_TS, "index.ts"), content, "utf-8");

	console.log("TypeScript types generated successfully.");
}

async function generateSwift(
	schemaFiles: LoadedSchemaFile[],
	definitions: Awaited<ReturnType<typeof loadSduiRowDefinitions>>,
): Promise<void> {
	await mkdir(OUT_SWIFT, { recursive: true });

	// Only schemas the Xcode target actually compiles are run through
	// quicktype (SDUI Swift comes from generate-swift-sdui.ts below). The
	// other schema outputs (Rpc*, Data*, Common*) had no iOS consumers; add a
	// schema key back here if iOS ever adopts one.
	const SWIFT_QUICKTYPE_SCHEMAS = new Set(["data/os", "files/file"]);
	const schemaFilesToQuicktype = schemaFiles.filter((f) =>
		SWIFT_QUICKTYPE_SCHEMAS.has(f.schemaKey),
	);

	// Run quicktype invocations sequentially: spawning every schema's process at
	// once (via Promise.all) races on the shared `bunx` resolution and overloads the
	// machine, which intermittently kills processes (exit 1 / null). Each run is fast,
	// so a sequential loop keeps generation deterministic.
	for (const { schemaPath } of schemaFilesToQuicktype) {
		const typeName = schemaPathToTypeName(schemaPath);
		const outPath = join(OUT_SWIFT, `${typeName}.swift`);

		await spawnExitOk(
			"bunx",
			[
				"quicktype",
				"--src-lang",
				"schema",
				"--lang",
				"swift",
				"--no-initializers",
				"--no-date-times",
				"-o",
				outPath,
				schemaPath,
			],
			{ stdio: "inherit", cwd: REPO_ROOT },
			"quicktype",
		);
	}

	const evySchemaFile = schemaFiles.find((f) => f.schemaKey === "sdui/evy");
	const actionSchemaFile = schemaFiles.find(
		(f) => f.schemaKey === "sdui/action",
	);
	if (!evySchemaFile || !actionSchemaFile) {
		throw new Error(
			"Missing sdui/evy or sdui/action schema for Swift SDUI generation",
		);
	}

	const swiftFiles = emitSwiftSdui({
		definitions,
		schema: evySchemaFile.schema,
		actionSchema: actionSchemaFile.schema,
	});
	await Promise.all(
		swiftFiles.map((file) => writeFile(file.path, file.content, "utf-8")),
	);

	console.log("Swift types generated successfully.");
}

async function main(): Promise<void> {
	await rm(OUT_TS, { recursive: true, force: true });
	await mkdir(OUT_TS, { recursive: true });
	await rm(OUT_SWIFT, { recursive: true, force: true });
	await mkdir(OUT_SWIFT, { recursive: true });

	const schemaPaths = (await findSchemaFiles(SCHEMA_DIR)).sort();
	const schemaFiles = await loadSchemaFiles(schemaPaths);
	await generateSduiDefinitions();

	await Promise.all([
		generateTypeScript(schemaFiles),
		generateSwift(schemaFiles, await loadSduiRowDefinitions()),
	]);
}

if (import.meta.main) {
	runMain(main);
}
