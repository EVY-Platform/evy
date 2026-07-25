import { describe, expect, test } from "bun:test";

import {
	parseActionStringToInvocation,
	serializeInvocationToLegacyString,
} from "../types/actionAst";
import { validateDataEvyRow } from "../types/validators";

/**
 * Converts every action branch in the shipped fixtures. This is the evidence
 * that the AST covers the real corpus, not just hand-picked examples: any
 * branch that fails to convert, fails to round-trip, or produces something the
 * schema rejects fails a test here rather than surfacing during the migration.
 */

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

type Branch = { source: string; branch: string };

async function loadFixtureBranches(): Promise<Branch[]> {
	const branches: Branch[] = [];
	for (const relative of FIXTURES) {
		const url = new URL(`./fixtures/${relative}`, import.meta.url);
		const flows = await Bun.file(url).json();
		walk(flows, relative, branches);
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
					if (typeof branch === "string" && branch.trim()) {
						out.push({ source, branch });
					}
				}
			}
		}
	}

	for (const value of Object.values(record)) walk(value, source, out);
}

const fixtureBranches = await loadFixtureBranches();

function rowWithBranch(branch: unknown) {
	return {
		id: "11111111-1111-4111-8111-111111111111",
		name: "R",
		type: "Button",
		visible: "true",
		createdAt: "2024-01-01T00:00:00.000Z",
		updatedAt: "2024-01-01T00:00:00.000Z",
		visibility: "public" as const,
		data: {
			actions: { tap: [{ condition: "", false: "", true: branch }] },
		},
	};
}

describe("action AST conversion over the shipped fixtures", () => {
	test("the fixtures actually contain action branches", () => {
		expect(fixtureBranches.length).toBeGreaterThan(20);
	});

	test("every fixture branch converts", () => {
		const failures = fixtureBranches
			.map(({ source, branch }) => {
				const result = parseActionStringToInvocation(branch);
				return result.ok
					? null
					: `${source}: ${branch} -> ${result.reason}`;
			})
			.filter((entry): entry is string => entry !== null);

		expect(failures).toEqual([]);
	});

	test("every converted branch round-trips back to an identical AST", () => {
		const mismatches: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			const first = parseActionStringToInvocation(branch);
			if (!first.ok) continue;
			const again = parseActionStringToInvocation(
				serializeInvocationToLegacyString(first.invocation),
			);
			if (
				!again.ok ||
				JSON.stringify(again.invocation) !==
					JSON.stringify(first.invocation)
			) {
				mismatches.push(`${source}: ${branch}`);
			}
		}
		expect(mismatches).toEqual([]);
	});

	test("every converted branch satisfies the row schema", () => {
		const rejected: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			const result = parseActionStringToInvocation(branch);
			if (!result.ok) continue;
			try {
				validateDataEvyRow(rowWithBranch(result.invocation));
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

	test("covers every action function used by the fixtures", () => {
		const functions = new Set<string>();
		for (const { branch } of fixtureBranches) {
			const result = parseActionStringToInvocation(branch);
			if (result.ok) functions.add(result.invocation.fn);
		}
		// Guards against the corpus quietly losing coverage of a function.
		expect([...functions].sort()).toContain("create");
		expect([...functions].sort()).toContain("update");
		expect([...functions].sort()).toContain("navigate");
	});
});
