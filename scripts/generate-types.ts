import { compile } from "json-schema-to-typescript";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { spawn } from "node:child_process";
import {
	OUT_SWIFT,
	OUT_TS,
	REPO_ROOT,
	SCHEMA_DIR,
	TYPES_ROOT,
	schemaPathToSwiftTypeName,
	schemaPathToTsName,
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

type ExternalTypeImport = {
	modulePath: string;
	typeName: string;
};

type GeneratedTsSchema = {
	schemaPath: string;
	schemaKey: string;
	schema: Record<string, unknown>;
	outPath: string;
	outModulePath: string;
};

async function findSchemaFiles(dir: string, base: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const out: string[] = [];
	for (const e of entries) {
		const full = join(dir, e.name);
		if (e.isDirectory()) {
			out.push(...(await findSchemaFiles(full, base)));
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
		const rawSchema = await readFile(schemaPath, "utf-8");
		const schema = JSON.parse(rawSchema) as Record<string, unknown>;
		loadedFiles.push({
			schemaPath,
			schemaKey: relative(SCHEMA_DIR, schemaPath)
				.replace(/\.schema\.json$/, "")
				.replace(/\\/g, "/"),
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
			// Recursive defs like JSONValue -> JSONScalar need a cycle guard.
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

function collectExternalRefs(
	obj: unknown,
	refs: Set<string> = new Set(),
): Set<string> {
	if (Array.isArray(obj)) {
		for (const item of obj) collectExternalRefs(item, refs);
		return refs;
	}
	if (obj && typeof obj === "object") {
		const record = obj as Record<string, unknown>;
		const ref = record.$ref;
		if (typeof ref === "string" && !ref.startsWith("#/")) {
			refs.add(ref);
		}
		for (const value of Object.values(record)) {
			collectExternalRefs(value, refs);
		}
	}
	return refs;
}

function getRootTypeName(
	schemaPath: string,
	schema: Record<string, unknown>,
): string {
	return (
		(schema.title as string | undefined) ??
		schemaPathToSwiftTypeName(schemaPath)
	);
}

function parseExternalRef(ref: string): {
	relativeSchemaRef: string;
	fragment: string;
} {
	const [relativeSchemaRef, fragment = ""] = ref.split("#");
	return { relativeSchemaRef, fragment };
}

function getReferencedTypeName(
	targetSchemaPath: string,
	targetSchema: Record<string, unknown>,
	fragment: string,
): string {
	if (fragment.startsWith("/$defs/")) {
		return fragment.replace(/^\/\$defs\//, "");
	}
	return getRootTypeName(targetSchemaPath, targetSchema);
}

function toImportModulePath(
	fromModulePath: string,
	targetModulePath: string,
): string {
	const rel = relative(dirname(fromModulePath), targetModulePath).replace(
		/\\/g,
		"/",
	);
	return rel.startsWith(".") ? rel : `./${rel}`;
}

function resolveExternalTypeImports(
	generatedSchema: GeneratedTsSchema,
	schemaByPath: Map<string, LoadedSchemaFile>,
): ExternalTypeImport[] {
	const importsByModule = new Map<string, Set<string>>();

	// Convert external schema refs into `import type` lines that point at the
	// already-generated module instead of re-declaring the same shapes locally.
	for (const ref of collectExternalRefs(generatedSchema.schema)) {
		const { relativeSchemaRef, fragment } = parseExternalRef(ref);
		const targetSchemaPath = join(
			dirname(generatedSchema.schemaPath),
			relativeSchemaRef,
		);
		const loadedTarget = schemaByPath.get(targetSchemaPath);
		if (!loadedTarget) continue;

		const targetModulePath = schemaPathToTsName(targetSchemaPath);
		if (targetModulePath === generatedSchema.outModulePath) continue;

		const typeName = getReferencedTypeName(
			targetSchemaPath,
			loadedTarget.schema,
			fragment,
		);

		if (!importsByModule.has(targetModulePath)) {
			importsByModule.set(targetModulePath, new Set());
		}
		importsByModule.get(targetModulePath)?.add(typeName);
	}

	return [...importsByModule.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.flatMap(([targetModulePath, typeNames]) => {
			const normalizedModulePath = toImportModulePath(
				generatedSchema.outModulePath,
				targetModulePath,
			);
			return [...typeNames]
				.sort((left, right) => left.localeCompare(right))
				.map((typeName) => ({
					modulePath: normalizedModulePath,
					typeName,
				}));
		});
}

function injectImports(ts: string, imports: ExternalTypeImport[]): string {
	if (imports.length === 0) return ts;

	const groupedImports = new Map<string, string[]>();
	for (const entry of imports) {
		const current = groupedImports.get(entry.modulePath) ?? [];
		current.push(entry.typeName);
		groupedImports.set(entry.modulePath, current);
	}

	const importBlock = [...groupedImports.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([modulePath, typeNames]) => {
			const uniqueTypeNames = [...new Set(typeNames)].sort((left, right) =>
				left.localeCompare(right),
			);
			return `import type { ${uniqueTypeNames.join(", ")} } from "${modulePath}";`;
		})
		.join("\n");

	// Keep generated imports immediately below the banner comment so the rest of
	// the file still matches json-schema-to-typescript output as closely as possible.
	const bannerEnd = ts.indexOf("\n\n");
	if (bannerEnd === -1) return `${importBlock}\n\n${ts}`;
	return `${ts.slice(0, bannerEnd + 2)}${importBlock}\n\n${ts.slice(bannerEnd + 2)}`;
}

function buildGeneratedTsSchema(
	schemaFile: LoadedSchemaFile,
): GeneratedTsSchema {
	const outModulePath = schemaPathToTsName(schemaFile.schemaPath);
	return {
		...schemaFile,
		outModulePath,
		outPath: join(OUT_TS, `${outModulePath}.ts`),
	};
}

async function appendGeneratedText(
	outPath: string,
	text: string,
): Promise<void> {
	const current = await readFile(outPath, "utf-8");
	await writeFile(outPath, `${current.trimEnd()}\n\n${text}\n`, "utf-8");
}

async function appendSchemaSpecificExports(
	generatedSchema: GeneratedTsSchema,
): Promise<void> {
	const { outPath, schema, schemaKey } = generatedSchema;

	// These exports are small generation conveniences layered on top of the
	// compiled schema output, so they are appended after the main file is written.
	if (schemaKey === "sdui/evy") {
		const flowTypeEnum = (schema.properties as Record<string, unknown>)?.type as
			| { enum?: string[] }
			| undefined;
		const flowValues = flowTypeEnum?.enum ?? [];
		const rowDef = (schema.$defs as Record<string, unknown>)?.["SDUI_Row"] as
			| Record<string, unknown>
			| undefined;
		const rowTypeEnum = (rowDef?.properties as Record<string, unknown>)?.type as
			| { enum?: string[] }
			| undefined;
		const rowValues = rowTypeEnum?.enum ?? [];

		await appendGeneratedText(
			outPath,
			[
				`export const SDUI_FLOW_TYPE_VALUES = ${JSON.stringify(flowValues)} as const;`,
				`export const SDUI_ROW_TYPE_VALUES = ${JSON.stringify(rowValues)} as const;`,
			].join("\n"),
		);
		return;
	}

	if (schemaKey === "common/json") {
		await appendGeneratedText(outPath, "export type JSONValue = CommonJSON;");
		return;
	}

	if (schemaKey === "common/rpc") {
		await appendGeneratedText(outPath, "export type IdFilter = CommonRPC;");
		return;
	}

	if (schemaKey === "rpc/get.request") {
		const props = schema.properties as Record<string, { enum?: string[] }>;
		const namespaceValues = props?.namespace?.enum ?? [];
		const resourceValues = props?.resource?.enum ?? [];
		await appendGeneratedText(
			outPath,
			[
				`export const NAMESPACE_VALUES = ${JSON.stringify(namespaceValues)} as const;`,
				`export const RESOURCE_VALUES = ${JSON.stringify(resourceValues)} as const;`,
			].join("\n"),
		);
	}
}

function buildIndexExportLine(
	schemaPath: string,
	schema: Record<string, unknown>,
): string {
	const rel = schemaPathToTsName(schemaPath);
	const mod = rel.replace(/\.ts$/, "");
	const title = (schema.title as string | undefined) ?? null;

	if (mod.startsWith("sdui/") && mod.includes("sdui")) {
		return `export * from "./${mod}";`;
	}
	if (mod.startsWith("data/") && mod.includes("data")) {
		return `export * from "./${mod}";`;
	}
	if (mod === "common/json" || mod === "common/rpc") {
		return `export * from "./${mod}";`;
	}
	if (mod === "rpc/get.request") {
		return `export type { GetRequest } from "./${mod}";\nexport { NAMESPACE_VALUES, RESOURCE_VALUES } from "./${mod}";`;
	}

	const name =
		title ?? schemaPathToSwiftTypeName(schemaPath).replace(/^Rpc/, "");
	return `export type { ${name} } from "./${mod}";`;
}

async function generateTypeScript(
	schemaFiles: LoadedSchemaFile[],
): Promise<void> {
	const schemaByPath = new Map(
		schemaFiles.map((file) => [file.schemaPath, file] as const),
	);

	await Promise.all(
		schemaFiles.map(async (schemaFile) => {
			const generatedSchema = buildGeneratedTsSchema(schemaFile);
			const { outPath, schemaPath, schemaKey, schema } = generatedSchema;

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
			const externalTypeImports = resolveExternalTypeImports(
				generatedSchema,
				schemaByPath,
			);
			const ts = await compile(schemaForCompile, title, {
				bannerComment: `/* eslint-disable */\n/** Generated from ${relative(TYPES_ROOT, schemaPath)} - do not edit. */`,
				declareExternallyReferenced: externalTypeImports.length === 0,
				style: { singleQuote: false },
				cwd: join(schemaPath, ".."),
			});
			const tsWithImports = injectImports(ts, externalTypeImports);
			await writeFile(outPath, tsWithImports, "utf-8");
			await appendSchemaSpecificExports(generatedSchema);
		}),
	);

	const lines: string[] = [];
	for (const { schemaPath: f, schema } of schemaFiles) {
		const exportLine = buildIndexExportLine(f, schema);
		if (
			exportLine.includes('export * from "./sdui/') ||
			exportLine.includes('export * from "./data/')
		) {
			lines.unshift(exportLine);
		} else {
			lines.push(exportLine);
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
				const safeSchemaKey = schemaKey.replace(/[\/\\]/g, "-");
				tempPath = join(
					TYPES_ROOT,
					`.quicktype-${safeSchemaKey}-tmp.schema.json`,
				);
				await writeFile(tempPath, JSON.stringify(withRef), "utf-8");
				inputPath = tempPath;
			}

			try {
				await new Promise<void>((resolve, reject) => {
					const proc = spawn(
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
					);
					proc.on("exit", (code) =>
						code === 0
							? resolve()
							: reject(new Error(`quicktype exited ${code}`)),
					);
					proc.on("error", reject);
				});
			} finally {
				if (tempPath) await rm(tempPath, { force: true });
			}
		}),
	);

	// Generate SDUI Swift from evy.schema.json + row-content.spec.json
	await new Promise<void>((resolve, reject) => {
		const proc = spawn(
			"bun",
			["run", join(REPO_ROOT, "scripts", "generate-swift-sdui.ts")],
			{
				stdio: "inherit",
				cwd: REPO_ROOT,
			},
		);
		proc.on("exit", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`generate-swift-sdui exited ${code}`)),
		);
		proc.on("error", reject);
	});

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

	const schemaPaths = (await findSchemaFiles(SCHEMA_DIR, SCHEMA_DIR)).sort();
	const schemaFiles = await loadSchemaFiles(schemaPaths);

	await Promise.all([
		generateTypeScript(schemaFiles),
		generateSwift(schemaFiles),
	]);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
