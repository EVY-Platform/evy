import { describe, expect, test } from "bun:test";
import type { ActionExpressionAst } from "evy-types/actionAst";

import { parseActionExpression } from "evy-types/actionAst";
import corpus from "../../../types/grammar/conformance.json";
import {
	type ConditionExpression,
	parseCondition,
} from "./conditionExpression";
import { splitFunctionArguments } from "./functionArgs";

/**
 * Shared grammar conformance corpus. See types/grammar/README.md - the Swift
 * runner (ios/evyTests/GrammarConformanceTests.swift) executes the same file.
 * Changing parser behaviour means changing a vector in the same commit.
 */

type Vector = {
	id: string;
	category: string;
	platforms: string[];
	input: string;
	data?: Record<string, unknown>;
	datum?: Record<string, unknown>;
	expect: Record<string, unknown>;
	notes?: string;
};

const vectors = corpus.vectors as Vector[];
const webVectors = vectors.filter((vector) => vector.platforms.includes("web"));

/** Strips undefined-valued keys so AST comparisons ignore absent optionals. */
function normalizeAst(expression: ConditionExpression | null): unknown {
	if (expression === null) return null;
	if (expression.type === "group") {
		return {
			kind: "group",
			operator: expression.logicalOperator,
			children: expression.children.map(normalizeAst),
		};
	}
	if (expression.type === "boolean") {
		return { kind: "boolean", value: expression.value };
	}
	return {
		kind: "leaf",
		left: expression.left,
		operator: expression.operator,
		right: expression.right,
	};
}

describe("grammar conformance corpus", () => {
	test("vector ids are unique", () => {
		const ids = vectors.map((vector) => vector.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	test("every vector targets at least one runner", () => {
		for (const vector of vectors) {
			expect(vector.platforms.length).toBeGreaterThan(0);
		}
	});

	test("the web runner covers every web vector", () => {
		const covered = new Set(
			webVectors
				.filter((vector) =>
					["split-args", "condition-parse", "action-parse"].includes(
						vector.category,
					),
				)
				.map((vector) => vector.id),
		);
		expect(covered.size).toBe(webVectors.length);
	});
});

describe("split-args", () => {
	for (const vector of webVectors.filter(
		(v) => v.category === "split-args",
	)) {
		test(vector.id, () => {
			expect(splitFunctionArguments(vector.input)).toEqual(
				vector.expect.args as string[],
			);
		});
	}
});

describe("condition-parse", () => {
	for (const vector of webVectors.filter(
		(v) => v.category === "condition-parse",
	)) {
		test(vector.id, () => {
			expect(normalizeAst(parseCondition(vector.input))).toEqual(
				vector.expect.ast,
			);
		});
	}
});

describe("action-parse", () => {
	for (const vector of webVectors.filter(
		(v) => v.category === "action-parse",
	)) {
		test(vector.id, () => {
			const result = parseActionExpression(vector.input);
			if ("error" in vector.expect) {
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.reason).toBe(vector.expect.error as string);
				}
				return;
			}
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.ast).toEqual(
					vector.expect.ast as ActionExpressionAst,
				);
			}
		});
	}
});
