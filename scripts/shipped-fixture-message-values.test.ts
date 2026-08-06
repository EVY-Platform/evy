import { describe, expect, test } from "bun:test";
import { EVY_MESSAGE_DATA_VALUES } from "../types/generated/ts/coreResources";

const FIXTURES = ["evy/evy_sdui.json", "services/service_sdui.json"] as const;

// `value == "sent"`, `value != pending`, and `value: cancel` — the three ways a
// fixture expression names a message value. Only strings that mention
// `evy.messages` are scanned, so a lookup row's own `value` field is left alone.
const VALUE_REFERENCE =
	/value\s*(?:==|!=)\s*"?([a-z_]+)"?|value:\s*"?([a-z_]+)"?/g;

type ValueReference = { source: string; expression: string; value: string };

function collectStrings(node: unknown, out: string[]): void {
	if (typeof node === "string") {
		out.push(node);
		return;
	}
	if (Array.isArray(node)) {
		for (const item of node) collectStrings(item, out);
		return;
	}
	if (!node || typeof node !== "object") return;
	for (const item of Object.values(node)) collectStrings(item, out);
}

async function loadValueReferences(): Promise<ValueReference[]> {
	const references: ValueReference[] = [];
	for (const relative of FIXTURES) {
		const url = new URL(`./fixtures/${relative}`, import.meta.url);
		const strings: string[] = [];
		collectStrings(await Bun.file(url).json(), strings);
		for (const expression of strings) {
			if (!expression.includes("evy.messages")) continue;
			for (const match of expression.matchAll(VALUE_REFERENCE)) {
				references.push({
					source: relative,
					expression,
					value: match[1] ?? match[2] ?? "",
				});
			}
		}
	}
	return references;
}

const valueReferences = await loadValueReferences();

describe("shipped fixtures only name live message values", () => {
	test("the fixtures actually reference message values", () => {
		expect(valueReferences.length).toBeGreaterThan(10);
	});

	// A value the purchase state machine no longer knows makes its search or
	// condition silently unsatisfiable: the row just never renders.
	test("every referenced value is a known message value", () => {
		const known = new Set<string>(EVY_MESSAGE_DATA_VALUES);
		const unknown = valueReferences
			.filter((reference) => !known.has(reference.value))
			.map(
				(reference) =>
					`${reference.source}: "${reference.value}" in ${reference.expression}`,
			);

		expect(unknown).toEqual([]);
	});
});
