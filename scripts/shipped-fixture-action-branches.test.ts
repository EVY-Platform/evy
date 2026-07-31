import { describe, expect, test } from "bun:test";

import {
	type ActionExpressionAst,
	parseActionExpression,
} from "../types/actionAst";
import { validateDataEvyRow } from "../types/validators";

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

type Branch = { source: string; branch: string };

async function loadFixtureBranches(): Promise<Branch[]> {
	const branches: Branch[] = [];
	for (const relative of FIXTURES) {
		const url = new URL(`./fixtures/${relative}`, import.meta.url);
		walk(await Bun.file(url).json(), relative, branches);
	}
	return branches;
}

function walk(node: unknown, source: string, out: Branch[]): void {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, source, out);
		return;
	}
	if (!node || typeof node !== "object") return;

	const record = node as Record<string, unknown>;
	if (record.actions && typeof record.actions === "object") {
		for (const list of Object.values(
			record.actions as Record<string, unknown>,
		)) {
			if (!Array.isArray(list)) continue;
			for (const action of list) {
				if (!action || typeof action !== "object") continue;
				for (const key of ["true", "false"] as const) {
					const branch = (action as Record<string, unknown>)[key];
					if (branch === "" || branch === undefined) continue;
					out.push({ source, branch: branch as string });
				}
			}
		}
	}

	for (const value of Object.values(record)) walk(value, source, out);
}

const fixtureBranches = await loadFixtureBranches();

function rowWithBranch(branch: string) {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		name: "R",
		type: "button",
		visible: "true",
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-01T00:00:00.000Z",
		visibility: "public" as const,
		data: {
			actions: { tap: [{ condition: "", false: "", true: branch }] },
		},
	};
}

function findUpdateChanges(
	ast: ActionExpressionAst,
): Record<string, string> | null {
	if (ast.fn !== "update" || !("changes" in ast) || !ast.changes) return null;
	return ast.changes;
}

describe("shipped fixtures satisfy the row schema", () => {
	test("the fixtures actually contain action branches", () => {
		expect(fixtureBranches.length).toBeGreaterThan(20);
	});

	test("no structured fn objects remain in fixture branches", () => {
		const structured: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			if (typeof branch === "object" && branch !== null) {
				structured.push(`${source}: ${JSON.stringify(branch)}`);
			}
		}
		expect(structured).toEqual([]);
	});

	test("every branch parses as an action expression", () => {
		const rejected: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			const parsed = parseActionExpression(branch.trim());
			if (!parsed.ok) {
				rejected.push(`${source}: ${branch} -> ${parsed.reason}`);
			}
		}
		expect(rejected).toEqual([]);
	});

	test("every branch satisfies the row schema", () => {
		const rejected: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			try {
				validateDataEvyRow(rowWithBranch(branch));
			} catch (error) {
				const detail =
					error instanceof Error ? error.message : String(error);
				rejected.push(
					`${source}: ${branch} -> ${detail.slice(0, 120)}`,
				);
			}
		}
		expect(rejected).toEqual([]);
	});

	test("linking a pickup address also copies the public location", () => {
		const ADDRESS_ID = "transfer_options.pickup.address_id";
		const REQUIRED = [
			"transfer_options.pickup.postcode",
			"transfer_options.pickup.latitude",
			"transfer_options.pickup.longitude",
		];
		const incomplete: string[] = [];

		for (const { source, branch } of fixtureBranches) {
			const parsed = parseActionExpression(branch.trim());
			if (!parsed.ok) continue;
			const changes = findUpdateChanges(parsed.ast);
			if (!changes) continue;
			const keys = Object.keys(changes);
			if (!keys.includes(ADDRESS_ID)) continue;

			const missing = REQUIRED.filter((field) => !keys.includes(field));
			if (missing.length > 0) {
				incomplete.push(`${source}: missing ${missing.join(", ")}`);
			}
		}

		expect(incomplete).toEqual([]);
	});

	test("covers the action functions the flows rely on", () => {
		const functions = new Set(
			fixtureBranches
				.map(({ branch }) => {
					if (!branch.trim()) return undefined;
					const parsed = parseActionExpression(branch.trim());
					return parsed.ok ? parsed.ast.fn : undefined;
				})
				.filter((fn): fn is string => Boolean(fn)),
		);

		for (const expected of [
			"create",
			"update",
			"navigate",
			"show",
			"select",
		]) {
			expect([...functions]).toContain(expected);
		}
	});
});
