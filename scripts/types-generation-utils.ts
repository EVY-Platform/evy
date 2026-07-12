import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES_ROOT = join(REPO_ROOT, "types");
const SCHEMA_DIR = join(TYPES_ROOT, "schema");
const OUT_TS = join(TYPES_ROOT, "generated", "ts");
const OUT_SWIFT = join(TYPES_ROOT, "generated", "swift");
const SDUI_DEFINITIONS_DIR = join(SCHEMA_DIR, "sdui", "definitions");

export {
	OUT_SWIFT,
	OUT_TS,
	REPO_ROOT,
	SCHEMA_DIR,
	SDUI_DEFINITIONS_DIR,
	TYPES_ROOT,
};

/** Path relative to `SCHEMA_DIR` with `.schema.json` / `.json` stripped (OS-native separators). */
function schemaPathRelativeToSchemaDir(schemaPath: string): string {
	return relative(SCHEMA_DIR, schemaPath)
		.replace(/\.schema\.json$/, "")
		.replace(/\.json$/, "");
}

export function schemaPathToTsName(schemaPath: string): string {
	return schemaPathRelativeToSchemaDir(schemaPath).replace(/[/\\]/g, "/");
}

function pascalCaseIdentifierPart(value: string): string {
	return value
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

export function schemaPathToSwiftTypeName(schemaPath: string): string {
	return schemaPathRelativeToSchemaDir(schemaPath)
		.split(/[/\\.]+/)
		.map(pascalCaseIdentifierPart)
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

export function generatedFileHeader(schemaPath: string): string[] {
	return [
		"/* eslint-disable */",
		`/** Generated from ${schemaPath} - do not edit. */`,
		"",
	];
}

export function generatedSwiftHeader(schemaPath: string): string[] {
	return [
		`// Generated from ${schemaPath} - do not edit.`,
		"// Run `bun run types:generate` from repo root to regenerate.",
		"",
	];
}

export function resourceKey(name: string): string {
	return name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

export function swiftCaseName(name: string): string {
	const camel = name.replace(/_([a-z])/g, (_match, character) =>
		character.toUpperCase(),
	);
	return /^\d/.test(camel) ? `_${camel}` : camel;
}

export async function writeGeneratedOutputs({
	tsPath,
	tsContent,
	swiftPath,
	swiftContent,
}: {
	tsPath: string;
	tsContent: string;
	swiftPath: string;
	swiftContent: string;
}): Promise<void> {
	await mkdir(dirname(tsPath), { recursive: true });
	await writeFile(tsPath, tsContent, "utf-8");
	console.log(`Generated ${tsPath}`);

	await mkdir(dirname(swiftPath), { recursive: true });
	await writeFile(swiftPath, swiftContent, "utf-8");
	console.log(`Generated ${swiftPath}`);
}

export async function appendLinesToGeneratedFile(
	outPath: string,
	lines: string[],
): Promise<void> {
	const current = await readFile(outPath, "utf-8");
	await writeFile(
		outPath,
		`${current.trimEnd()}\n\n${lines.join("\n")}\n`,
		"utf-8",
	);
}

export function spawnExitOk(
	command: string,
	args: string[],
	options: { cwd: string; stdio?: "inherit" },
	errorLabel: string,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const existingNodeOptions = process.env.NODE_OPTIONS ?? "";
		const proc = spawn(command, args, {
			...options,
			env: {
				...process.env,
				// quicktype pulls in the deprecated `punycode` core module
				// transitively; silence only that warning (DEP0040).
				NODE_OPTIONS:
					`${existingNodeOptions} --disable-warning=DEP0040`.trim(),
			},
		});
		proc.on("exit", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${errorLabel} exited ${code}`)),
		);
		proc.on("error", reject);
	});
}
