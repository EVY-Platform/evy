import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES_ROOT = join(REPO_ROOT, "types");
const SCHEMA_DIR = join(TYPES_ROOT, "schema");
const OUT_TS = join(TYPES_ROOT, "generated", "ts");
const OUT_SWIFT = join(TYPES_ROOT, "generated", "swift");

export { REPO_ROOT, TYPES_ROOT, SCHEMA_DIR, OUT_TS, OUT_SWIFT };

/** Path relative to `SCHEMA_DIR` with `.schema.json` / `.json` stripped (OS-native separators). */
function schemaPathRelativeToSchemaDir(schemaPath: string): string {
	return relative(SCHEMA_DIR, schemaPath)
		.replace(/\.schema\.json$/, "")
		.replace(/\.json$/, "");
}

export function schemaPathToTsName(schemaPath: string): string {
	return schemaPathRelativeToSchemaDir(schemaPath).replace(/[/\\]/g, "/");
}

export function schemaPathToSwiftTypeName(schemaPath: string): string {
	return schemaPathRelativeToSchemaDir(schemaPath)
		.replace(/[/\\]/g, ".")
		.split(".")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join("");
}

export async function loadJson<T>(path: string): Promise<T> {
	const raw = await readFile(path, "utf-8");
	return JSON.parse(raw) as T;
}

export function runMain(main: () => Promise<void>): void {
	main().catch((err: unknown) => {
		console.error(err);
		process.exit(1);
	});
}
