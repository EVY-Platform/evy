import { describe, expect, test } from "bun:test";

import {
	type ActionExpressionAst,
	parseActionExpression,
} from "../types/actionAst";
import { validateDataEvyRow } from "../types/validators";

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

type FixtureBranch = {
	source: string;
	branch: string;
	ast?: ActionExpressionAst;
	parseError?: string;
};

async function loadFixtureBranches(): Promise<FixtureBranch[]> {
	const branches: FixtureBranch[] = [];
	for (const relative of FIXTURES) {
		const url = new URL(`./fixtures/${relative}`, import.meta.url);
		walk(await Bun.file(url).json(), relative, branches);
	}
	return branches;
}

function walk(node: unknown, source: string, out: FixtureBranch[]): void {
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
					const branchText = branch as string;
					const parsed = parseActionExpression(branchText.trim());
					out.push({
						source,
						branch: branchText,
						ast: parsed.ok ? parsed.ast : undefined,
						parseError: parsed.ok ? undefined : parsed.reason,
					});
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

function findCreateInlineData(
	ast: ActionExpressionAst,
): Record<string, string> | null {
	if (ast.fn !== "create" || ast.mode !== "inline") return null;
	return ast.data;
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
		for (const { source, branch, parseError } of fixtureBranches) {
			if (parseError) {
				rejected.push(`${source}: ${branch} -> ${parseError}`);
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

		for (const { source, ast } of fixtureBranches) {
			if (!ast) continue;
			const changes = findUpdateChanges(ast);
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

	test("pickup_address on accept is guarded on request type", () => {
		const unguarded: string[] = [];

		for (const { source, branch, ast } of fixtureBranches) {
			if (!ast) continue;
			const data = findCreateInlineData(ast);
			if (!data) continue;
			const pickupAddress = data.pickup_address;
			if (!pickupAddress?.includes("findFirst(evy.addresses")) continue;
			if (!pickupAddress.includes("type == pickup")) {
				unguarded.push(`${source}: ${branch}`);
			}
		}

		expect(unguarded).toEqual([]);
	});

	test("delivery and shipping request creates include destination_address", () => {
		const missing: string[] = [];

		for (const { source, branch, ast } of fixtureBranches) {
			if (!ast) continue;
			const data = findCreateInlineData(ast);
			if (!data) continue;
			if (!data.value?.includes("pending")) continue;

			if (
				data.type?.includes("delivery") &&
				!data.data?.includes("destination_address")
			) {
				missing.push(`${source}: ${branch}`);
			}
			if (
				data.type?.includes("shipping") &&
				!data.data?.includes("destination_address")
			) {
				missing.push(`${source}: ${branch}`);
			}
		}

		expect(missing).toEqual([]);
	});

	test("item-page cancel messages forward delivery and shipping addresses", () => {
		const violations: string[] = [];

		for (const { source, branch } of fixtureBranches) {
			if (!branch.includes("value: cancel")) continue;

			if (
				branch.includes("type == delivery") &&
				!branch.includes("destination_address")
			) {
				violations.push(`${source}: ${branch}`);
			}
			if (branch.includes("type == shipping")) {
				if (!branch.includes("destination_address")) {
					violations.push(`${source}: ${branch}`);
				}
				if (!branch.includes("postalcode")) {
					violations.push(`${source}: ${branch}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	test("covers the action functions the flows rely on", () => {
		const functions = new Set(
			fixtureBranches
				.map(({ ast }) => ast?.fn)
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
