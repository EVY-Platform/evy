import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVICES_ROOT = resolve(REPO_ROOT, "services");

const SCAN_ROOTS = ["api", "web"] as const;

const IMPORT_PATTERN = /(?:import|export)\s+[^;]*?\sfrom\s+["']([^"']+)["']/g;

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules") {
				continue;
			}
			files.push(...(await collectTypeScriptFiles(entryPath)));
			continue;
		}
		if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
			files.push(entryPath);
		}
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

	const resolvedImportPath = resolve(dirname(importerPath), importSpecifier);
	return (
		resolvedImportPath === SERVICES_ROOT ||
		resolvedImportPath.startsWith(`${SERVICES_ROOT}/`)
	);
}

function findForbiddenImports(importerPath: string, source: string): string[] {
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

describe("package boundaries", () => {
	it("rejects api and web imports into services/", async () => {
		const violations: string[] = [];

		for (const scanRoot of SCAN_ROOTS) {
			const scanDirectory = join(REPO_ROOT, scanRoot);
			const files = await collectTypeScriptFiles(scanDirectory);

			for (const filePath of files) {
				const source = await readFile(filePath, "utf8");
				const forbiddenImports = findForbiddenImports(filePath, source);
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
