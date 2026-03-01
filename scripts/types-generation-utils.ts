import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES_ROOT = join(REPO_ROOT, "types");
const SCHEMA_DIR = join(TYPES_ROOT, "schema");
const OUT_TS = join(TYPES_ROOT, "generated", "ts");
const OUT_SWIFT = join(TYPES_ROOT, "generated", "swift");

export { REPO_ROOT, TYPES_ROOT, SCHEMA_DIR, OUT_TS, OUT_SWIFT };

export function schemaPathToTsName(schemaPath: string): string {
	return relative(SCHEMA_DIR, schemaPath)
		.replace(/\.schema\.json$/, "")
		.replace(/\.json$/, "")
		.replace(/[/\\]/g, "/");
}

export function schemaPathToSwiftTypeName(schemaPath: string): string {
	return relative(SCHEMA_DIR, schemaPath)
		.replace(/\.schema\.json$/, "")
		.replace(/\.json$/, "")
		.replace(/[/\\]/g, ".")
		.split(".")
		.map((p) => p.charAt(0).toUpperCase() + p.slice(1))
		.join("");
}
