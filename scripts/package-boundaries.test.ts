import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVICES_ROOT = resolve(REPO_ROOT, "services");

const SCAN_ROOTS = ["api", "web"] as const;

const ALLOWED_MARKETPLACE_IMPORTERS = new Set(["scripts/seed.ts"]);

const IMPORT_PATTERN = /(?:import|export)\s+[^;]*?\sfrom\s+["']([^"']+)["']/g;

async function collectTypeScriptFiles(scanRoot: string): Promise<string[]> {
	const glob = new Glob("**/*.{ts,tsx}");
	const files: string[] = [];
	for await (const relativePath of glob.scan({
		cwd: join(REPO_ROOT, scanRoot),
		onlyFiles: true,
	})) {
		if (relativePath.includes("node_modules")) continue;
		files.push(join(REPO_ROOT, scanRoot, relativePath));
	}
	return files;
}

function isForbiddenServiceImport(
	importerPath: string,
	importSpecifier: string,
): boolean {
	if (!importSpecifier.startsWith(".")) {
		return false;
	}

	const relativeImporter = importerPath.slice(REPO_ROOT.length + 1);
	if (ALLOWED_MARKETPLACE_IMPORTERS.has(relativeImporter)) {
		return false;
	}

	const resolvedImportPath = resolve(dirname(importerPath), importSpecifier);
	return (
		resolvedImportPath === SERVICES_ROOT ||
		resolvedImportPath.startsWith(`${SERVICES_ROOT}/`)
	);
}

function findForbiddenImportsInTsx(
	importerPath: string,
	source: string,
): string[] {
	const violations: string[] = [];

	for (const match of source.matchAll(IMPORT_PATTERN)) {
		const importSpecifier = match[1];
		if (
			importSpecifier &&
			isForbiddenServiceImport(importerPath, importSpecifier)
		) {
			violations.push(importSpecifier);
		}
	}

	return violations;
}

function findForbiddenImportsInTs(
	importerPath: string,
	source: string,
): string[] {
	const violations: string[] = [];
	const transpiler = new Bun.Transpiler({ loader: "ts" });

	for (const entry of transpiler.scanImports(source)) {
		if (isForbiddenServiceImport(importerPath, entry.path)) {
			violations.push(entry.path);
		}
	}

	return violations;
}

describe("package boundaries", () => {
	it("rejects api and web imports into services/", async () => {
		const violations: string[] = [];

		for (const scanRoot of SCAN_ROOTS) {
			const files = await collectTypeScriptFiles(scanRoot);

			for (const filePath of files) {
				const source = await readFile(filePath, "utf8");
				const forbiddenImports = filePath.endsWith(".tsx")
					? findForbiddenImportsInTsx(filePath, source)
					: findForbiddenImportsInTs(filePath, source);
				for (const importSpecifier of forbiddenImports) {
					const relativeImporter = filePath.slice(
						REPO_ROOT.length + 1,
					);
					violations.push(
						`${relativeImporter} imports forbidden path "${importSpecifier}"`,
					);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
