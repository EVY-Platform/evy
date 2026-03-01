import { compile } from "json-schema-to-typescript";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
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
): unknown {
	if (obj && typeof obj === "object" && !Array.isArray(obj)) {
		const o = obj as Record<string, unknown>;
		const ref = o.$ref as string | undefined;
		if (ref?.startsWith("#/$defs/")) {
			const name = ref.replace(/^#\/\$defs\//, "");
			const d = defsMap[name];
			return d !== undefined
				? inlineDefsRefs(JSON.parse(JSON.stringify(d)), defsMap)
				: obj;
		}
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(o)) {
			out[k] = inlineDefsRefs(v, defsMap);
		}
		return out;
	}
	if (Array.isArray(obj))
		return obj.map((item) => inlineDefsRefs(item, defsMap));
	return obj;
}

async function generateTypeScript(
	schemaFiles: LoadedSchemaFile[],
): Promise<void> {
	await Promise.all(
		schemaFiles.map(async ({ schemaPath, schemaKey, schema }) => {
			const outRel = schemaPathToTsName(schemaPath) + ".ts";
			const outPath = join(OUT_TS, outRel);

			await mkdir(join(outPath, ".."), { recursive: true });

			if (schemaKey === "common/json") {
				const ts = `${`/* eslint-disable */\n/** Generated from ${relative(TYPES_ROOT, schemaPath)} - do not edit. */`}\n\nexport interface CommonJSON {\n  [k: string]: string | number | boolean | null;\n}\n`;
				await writeFile(outPath, ts, "utf-8");
				return;
			}

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
			await writeFile(outPath, ts, "utf-8");

			if (schemaKey === "sdui/evy") {
				const flowTypeEnum = (schema.properties as Record<string, unknown>)
					?.type as { enum?: string[] } | undefined;
				const flowValues = flowTypeEnum?.enum ?? [];
				const rowDef = (schema.$defs as Record<string, unknown>)?.[
					"SDUI_Row"
				] as Record<string, unknown> | undefined;
				const rowTypeEnum = (rowDef?.properties as Record<string, unknown>)
					?.type as { enum?: string[] } | undefined;
				const rowValues = rowTypeEnum?.enum ?? [];
				const flowLine = `export const SDUI_FLOW_TYPE_VALUES = ${JSON.stringify(flowValues)} as const;`;
				const rowLine = `export const SDUI_ROW_TYPE_VALUES = ${JSON.stringify(rowValues)} as const;`;
				const current = await readFile(outPath, "utf-8");
				await writeFile(
					outPath,
					`${current.trimEnd()}\n\n${flowLine}\n${rowLine}\n`,
					"utf-8",
				);
			}
		}),
	);

	const lines: string[] = [];
	for (const { schemaPath: f, schema } of schemaFiles) {
		const rel = schemaPathToTsName(f);
		const mod = rel.replace(/\.ts$/, "");
		const title = (schema.title as string | undefined) ?? null;
		if (mod.startsWith("sdui/") && mod.includes("sdui")) {
			lines.unshift(`export * from "./${mod}";`);
		} else if (mod.startsWith("data/") && mod.includes("data")) {
			lines.unshift(`export * from "./${mod}";`);
		} else {
			const name = title ?? schemaPathToSwiftTypeName(f).replace(/^Rpc/, "");
			lines.push(`export { ${name} } from "./${mod}";`);
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

	// Skip sdui/evy — generated by generate-swift-sdui.ts from schema + row-content.spec.json
	const schemaFilesToQuicktype = schemaFiles.filter(
		(f) => f.schemaKey !== "sdui/evy",
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
