import { describe, expect, test } from "bun:test";

import {
	type ActionExpressionAst,
	parseActionExpression,
} from "../types/actionAst";
import { validateDataEvyRow } from "../types/validators";

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

const PURCHASE_CONFIRMATION_VALUES = [
	"transaction",
	"received",
	"failed",
	"given",
	"sent",
	"transaction_completed",
	"transaction_rejected",
] as const;

function purchaseConfirmationCreates(branches: FixtureBranch[]) {
	return branches.filter(({ ast }) => {
		if (ast?.fn !== "create" || ast.mode !== "inline") return false;
		const value = ast.data?.value;
		return (
			typeof value === "string" &&
			(PURCHASE_CONFIRMATION_VALUES as readonly string[]).includes(value)
		);
	});
}

type FixtureBranch = {
	source: string;
	branch: string;
	ast?: ActionExpressionAst;
	parseError?: string;
};

const malformedActions: string[] = [];

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
		for (const [trigger, list] of Object.entries(
			record.actions as Record<string, unknown>,
		)) {
			if (!Array.isArray(list)) continue;
			for (const action of list) {
				// A raw string here is the pre-migration array shape. Skipping it
				// would hide the branch from every check below, so record it.
				if (!action || typeof action !== "object") {
					malformedActions.push(
						`${source}: ${record.id}/${trigger} entry is ${typeof action}, expected a {condition,true,false} object`,
					);
					continue;
				}
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

	test("every action entry is a branch object", () => {
		expect(malformedActions).toEqual([]);
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

	// The TS parser recovers from a missing brace; iOS folds every later key into
	// the unclosed one and posts a payload with the required fields gone.
	test("every branch has balanced braces", () => {
		const unbalanced: string[] = [];
		for (const { source, branch } of fixtureBranches) {
			const opens = branch.split("{").length - 1;
			const closes = branch.split("}").length - 1;
			if (opens !== closes) {
				unbalanced.push(
					`${source}: ${opens} { vs ${closes} } in ${branch}`,
				);
			}
		}
		expect(unbalanced).toEqual([]);
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
			"clear",
		]) {
			expect([...functions]).toContain(expected);
		}
	});

	test("cancel confirmations clear their selected timeslot", () => {
		const clears = fixtureBranches
			.filter(({ ast }) => ast?.fn === "clear")
			.map(
				({ ast }) => (ast as { fn: "clear"; binding: string }).binding,
			);

		expect(clears).toContain("selected_pickup_timeslot");
		expect(clears).toContain("selected_delivery_timeslot");
	});

	test("view-item transfer options are ownership-gated", async () => {
		const url = new URL(
			"./fixtures/services/service_sdui.json",
			import.meta.url,
		);
		const flows = (await Bun.file(url).json()) as Array<{
			pages: Array<{ rows: Array<Record<string, unknown>> }>;
		}>;
		const rows = flows.flatMap((flow) =>
			flow.pages.flatMap((page) => page.rows),
		);
		const buyerTabs = rows.find(
			(row) => row.id === "ec3bef23-6d74-43eb-adde-8d498d9ed70e",
		);
		const ownerTabs = rows.find(
			(row) => row.id === "44444444-4444-4444-8444-444444444401",
		);

		expect(buyerTabs).toBeDefined();
		expect(ownerTabs).toBeDefined();
		expect(buyerTabs?.visible).toContain(
			"owns(marketplace.items, marketplace.items.id) == false",
		);
		expect(ownerTabs?.visible).toContain(
			"owns(marketplace.items, marketplace.items.id) == true",
		);
	});

	test("purchase confirmation creates cover the new message values", () => {
		const found = new Set<string>();

		for (const { ast } of purchaseConfirmationCreates(fixtureBranches)) {
			const value = ast?.data?.value;
			if (value) found.add(value);
		}

		expect([...found].sort()).toEqual(
			[...PURCHASE_CONFIRMATION_VALUES].sort(),
		);
	});

	test("purchase confirmation creates include parent_message_id and data", () => {
		const missing: string[] = [];

		for (const { source, branch, ast } of purchaseConfirmationCreates(
			fixtureBranches,
		)) {
			const data = ast?.data;
			if (!data?.parent_message_id || !data.data) {
				missing.push(`${source}: ${branch}`);
			}
		}

		expect(missing).toEqual([]);
	});

	test("search template variants end with a catch-all visible", async () => {
		const violations: string[] = [];
		for (const relative of FIXTURES) {
			const url = new URL(`./fixtures/${relative}`, import.meta.url);
			walkSearchVariants(
				await Bun.file(url).json(),
				relative,
				violations,
			);
		}
		expect(violations).toEqual([]);
	});
});

function walkSearchVariants(
	node: unknown,
	source: string,
	violations: string[],
): void {
	if (Array.isArray(node)) {
		for (const item of node) walkSearchVariants(item, source, violations);
		return;
	}
	if (!node || typeof node !== "object") return;

	const record = node as Record<string, unknown>;
	if (record.type === "search" && Array.isArray(record.children)) {
		const children = record.children as Array<Record<string, unknown>>;
		if (children.length > 0) {
			const last = children[children.length - 1];
			const visible =
				typeof last.visible === "string" ? last.visible.trim() : "";
			if (visible !== "" && visible !== "true") {
				violations.push(
					`${source}: search ${record.id} last variant visible must be blank or "true"`,
				);
			}
		}
	}

	for (const value of Object.values(record)) {
		walkSearchVariants(value, source, violations);
	}
}
