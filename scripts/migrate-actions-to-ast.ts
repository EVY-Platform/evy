/// <reference types="bun-types" />

/**
 * Rewrites legacy `{fn(...)}` action branches into structured invocations, in
 * the SDUI fixtures and in stored rows.
 *
 * Idempotent: a branch that is already structured is left alone, so the script
 * can be re-run safely. Nothing is written unless every branch in the target
 * converts - a partial migration is worse than none, because it leaves two
 * forms in the same flow with no record of which failed.
 *
 *   bun scripts/migrate-actions-to-ast.ts --dry-run     # report only
 *   bun scripts/migrate-actions-to-ast.ts --fixtures    # rewrite fixture files
 *   bun scripts/migrate-actions-to-ast.ts --database    # rewrite stored rows
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQL } from "bun";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { parseActionStringToInvocation } from "../types/actionAst";
import { getPostgresConnectionUrl } from "../types/env";
import { row as rowTable } from "../types/generated/ts/db/schema.generated";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATHS = [
	join(SCRIPT_DIR, "fixtures", "evy", "evy_sdui.json"),
	join(SCRIPT_DIR, "fixtures", "services", "service_sdui.json"),
];

type Stats = {
	converted: number;
	alreadyStructured: number;
	skipped: string[];
};

function emptyStats(): Stats {
	return { converted: 0, alreadyStructured: 0, skipped: [] };
}

/** Rewrites action branches in place, recording what happened. */
function convertActionsInPlace(
	node: unknown,
	stats: Stats,
	where: string,
): void {
	if (Array.isArray(node)) {
		for (const item of node) convertActionsInPlace(item, stats, where);
		return;
	}
	if (!node || typeof node !== "object") return;

	const record = node as Record<string, unknown>;
	const actions = record.actions;
	if (actions && typeof actions === "object" && !Array.isArray(actions)) {
		for (const list of Object.values(actions as Record<string, unknown>)) {
			if (!Array.isArray(list)) continue;
			for (const action of list) {
				if (!action || typeof action !== "object") continue;
				const entry = action as Record<string, unknown>;
				for (const key of ["true", "false"] as const) {
					const branch = entry[key];
					if (typeof branch !== "string") {
						if (branch) stats.alreadyStructured += 1;
						continue;
					}
					if (!branch.trim()) continue;

					const result = parseActionStringToInvocation(branch);
					if (!result.ok) {
						stats.skipped.push(
							`${where}: ${branch} (${result.reason})`,
						);
						continue;
					}
					entry[key] = result.invocation;
					stats.converted += 1;
				}
			}
		}
	}

	for (const value of Object.values(record)) {
		convertActionsInPlace(value, stats, where);
	}
}

async function migrateFixtures(dryRun: boolean): Promise<Stats> {
	const stats = emptyStats();
	for (const path of FIXTURE_PATHS) {
		const original = await readFile(path, "utf-8");
		const parsed = JSON.parse(original);
		convertActionsInPlace(parsed, stats, path);
		if (!dryRun && stats.skipped.length === 0) {
			await writeFile(
				path,
				`${JSON.stringify(parsed, null, "\t")}\n`,
				"utf-8",
			);
		}
	}
	return stats;
}

async function migrateDatabase(dryRun: boolean): Promise<Stats> {
	const stats = emptyStats();
	const client = new SQL(getPostgresConnectionUrl("DB_EVY_DATABASE"));
	const db = drizzle({ client });

	const rows = await db.select().from(rowTable);
	const pending: { id: string; data: unknown }[] = [];

	for (const stored of rows) {
		const data = structuredClone(stored.data) as Record<string, unknown>;
		const before = JSON.stringify(data);
		convertActionsInPlace(data, stats, `row ${stored.id}`);
		if (JSON.stringify(data) !== before) {
			pending.push({ id: stored.id, data });
		}
	}

	if (!dryRun && stats.skipped.length === 0) {
		for (const { id, data } of pending) {
			await db
				.update(rowTable)
				.set({ data: data as typeof rowTable.$inferInsert.data })
				.where(eq(rowTable.id, id));
		}
	}

	console.info(
		`${dryRun ? "would update" : "updated"} ${pending.length} row record(s)`,
	);
	await client.end();
	return stats;
}

function report(label: string, stats: Stats, dryRun: boolean): void {
	console.info(
		`${label}: ${dryRun ? "would convert" : "converted"} ${stats.converted}, ` +
			`already structured ${stats.alreadyStructured}, unconvertible ${stats.skipped.length}`,
	);
	for (const entry of stats.skipped) {
		console.warn(`  UNCONVERTIBLE ${entry}`);
	}
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has("--dry-run") || args.size === 0;
	const doFixtures = args.has("--fixtures") || dryRun;
	const doDatabase = args.has("--database") || dryRun;

	let unconvertible = 0;

	if (doFixtures) {
		const stats = await migrateFixtures(dryRun);
		report("fixtures", stats, dryRun);
		unconvertible += stats.skipped.length;
	}

	if (doDatabase) {
		const stats = await migrateDatabase(dryRun);
		report("database", stats, dryRun);
		unconvertible += stats.skipped.length;
	}

	if (unconvertible > 0) {
		console.error(
			`\nRefusing to write: ${unconvertible} branch(es) did not convert.`,
		);
		process.exit(1);
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
