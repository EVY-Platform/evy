import { describe, expect, test } from "bun:test";

import { validateDataEvyRow } from "../types/validators";

/**
 * Every action branch in the shipped fixtures satisfies the row schema.
 *
 * The schema admits only the empty string or a structured invocation, so this
 * also catches a fixture drifting to any other branch shape.
 */

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

type Branch = { source: string; branch: unknown };

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
					// An empty string is the canonical "do nothing" branch.
					if (branch === "" || branch === undefined) continue;
					out.push({ source, branch });
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

describe("shipped fixtures satisfy the row schema", () => {
	test("the fixtures actually contain action branches", () => {
		expect(fixtureBranches.length).toBeGreaterThan(20);
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
					`${source}: ${JSON.stringify(branch)} -> ${detail.slice(0, 120)}`,
				);
			}
		}
		expect(rejected).toEqual([]);
	});

	/**
	 * A marketplace item is public and the address it links to is private, so the
	 * public page reads the pickup location off the item. Linking an address
	 * without copying those fields leaves a page that renders a blank map and no
	 * location - which no other test notices, because nothing errors.
	 */
	test("linking a pickup address also copies the public location", () => {
		const ADDRESS_ID = "transfer_options.pickup.address_id";
		const REQUIRED = [
			"transfer_options.pickup.postcode",
			"transfer_options.pickup.latitude",
			"transfer_options.pickup.longitude",
		];
		const incomplete: string[] = [];

		for (const { source, branch } of fixtureBranches) {
			if (!branch || typeof branch !== "object") continue;
			const changes = (branch as { changes?: unknown }).changes;
			if (!changes || typeof changes !== "object") continue;
			const keys = Object.keys(changes as Record<string, unknown>);
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
				.map(({ branch }) =>
					branch && typeof branch === "object"
						? (branch as { fn?: string }).fn
						: undefined,
				)
				.filter((fn): fn is string => Boolean(fn)),
		);

		// Guards against the fixtures quietly losing coverage of a function.
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
