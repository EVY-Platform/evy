/**
 * One-off / maintenance: normalize seeded SDUI JSON under docs/ to the canonical
 * row shape (defaults merged). Run from repo root: bun scripts/normalize-sdui-docs.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeServerFlow } from "../web/app/utils/decodeFlow";
import { validateUiFlow } from "../types/validators";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const FILES = [
	join(SCRIPT_DIR, "..", "docs", "evy", "evy_sdui.json"),
	join(SCRIPT_DIR, "..", "docs", "services", "service_sdui.json"),
] as const;

async function main(): Promise<void> {
	for (const filePath of FILES) {
		const raw = await readFile(filePath, "utf-8");
		const parsed: unknown = JSON.parse(raw);
		const flows = Array.isArray(parsed) ? parsed : [parsed];
		const normalized = flows.map((f) =>
			validateUiFlow(normalizeServerFlow(validateUiFlow(f))),
		);
		const out = Array.isArray(parsed) ? normalized : normalized[0];
		await writeFile(filePath, `${JSON.stringify(out, null, "\t")}\n`, "utf-8");
		console.log(`Wrote ${filePath}`);
	}
}

await main();
