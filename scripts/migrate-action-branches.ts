/**
 * One-off codemod: convert structured `{fn: …}` action branches to expression
 * strings and migrate map values to braced-only semantics.
 *
 * Usage: bun scripts/migrate-action-branches.ts
 */

import {
	type ActionExpressionAst,
	type ActionExpressionMap,
	serializeActionExpression,
} from "../types/actionAst";
import { splitFunctionArguments } from "../types/functionArgs";

const FIXTURES = [
	"scripts/fixtures/services/service_sdui.json",
	"scripts/fixtures/evy/evy_sdui.json",
] as const;

const BARE_LITERALS = new Set([
	"pending",
	"cancel",
	"accept",
	"reject",
	"accepted",
	"pickup",
	"delivery",
	"shipping",
	"true",
	"false",
	"null",
]);

function isResourceLiteral(value: string): boolean {
	return /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(value);
}

function isNumericLiteral(value: string): boolean {
	return /^-?\d+(\.\d+)?$/.test(value);
}

function stripEscapedQuotes(value: string): string {
	const trimmed = value.trim();
	if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) {
		return trimmed;
	}
	const inner = trimmed.slice(1, -1);
	if (inner.startsWith('\\"') && inner.endsWith('\\"')) {
		return inner.slice(2, -2);
	}
	return inner;
}

function looksLikeInlineMap(value: string): boolean {
	const trimmed = value.trim();
	return (
		trimmed.startsWith("{") &&
		trimmed.endsWith("}") &&
		trimmed.includes(":")
	);
}

function shouldWrapAsBinding(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (BARE_LITERALS.has(trimmed)) return false;
	if (isNumericLiteral(trimmed)) return false;
	if (trimmed === "$datum") return false;

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		if (looksLikeInlineMap(trimmed)) return false;
		return false;
	}

	if (trimmed.startsWith("selected_")) return true;
	if (
		trimmed.startsWith("pickup_address") ||
		trimmed.startsWith("shipping_address")
	) {
		return true;
	}
	if (isResourceLiteral(trimmed)) return false;
	if (trimmed.startsWith("$datum")) return true;
	if (trimmed.includes("(")) return true;

	const dotCount = (trimmed.match(/\./g) ?? []).length;
	if (dotCount >= 2) return true;
	if (dotCount === 1 && !isResourceLiteral(trimmed)) return true;

	return false;
}

function migrateMapValue(value: string): string {
	let migrated = stripEscapedQuotes(value);
	if (looksLikeInlineMap(migrated)) {
		migrated = migrateInlineMapString(migrated);
	} else if (shouldWrapAsBinding(migrated)) {
		migrated = `{${migrated}}`;
	}
	return migrated;
}

function migrateInlineMapString(text: string): string {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
		return migrateMapValue(text);
	}

	const inner = trimmed.slice(1, -1).trim();
	if (!inner) return "{}";

	const pairs = splitFunctionArguments(inner).map((pair) => {
		const colonIndex = pair.indexOf(":");
		if (colonIndex === -1) return pair;
		const key = pair.slice(0, colonIndex).trim();
		const value = pair.slice(colonIndex + 1).trim();
		return `${key}: ${migrateMapValue(value)}`;
	});
	return `{${pairs.join(", ")}}`;
}

function migrateExpressionMap(
	map: Record<string, string>,
): ActionExpressionMap {
	const result: ActionExpressionMap = {};
	for (const [key, value] of Object.entries(map)) {
		result[key] = migrateMapValue(value);
	}
	return result;
}

function isActionInvocation(value: unknown): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as { fn?: unknown }).fn === "string"
	);
}

function structuredToAst(obj: Record<string, unknown>): ActionExpressionAst {
	const fn = obj.fn as ActionExpressionAst["fn"];

	switch (fn) {
		case "close":
		case "select_photo":
		case "expand_photo":
		case "delete_photo":
			return { fn };
		case "show":
		case "expand_text":
			return { fn, row_id: obj.row_id as string };
		case "highlight_required":
			return { fn, field: obj.field as string };
		case "select":
			return { fn, value: obj.value as string };
		case "navigate": {
			const query = obj.query as Record<string, string> | undefined;
			return {
				fn,
				flow_id: obj.flow_id as string,
				page_id: obj.page_id as string,
				...(query ? { query: migrateExpressionMap(query) } : {}),
			};
		}
		case "create": {
			const resource = obj.resource as string;
			if (obj.mode === "submit") {
				return { fn, resource, mode: "submit" };
			}
			if (obj.mode === "from_path") {
				return {
					fn,
					resource,
					mode: "from_path",
					data_path: obj.data_path as string,
					...(obj.id_destination
						? { id_destination: obj.id_destination as string }
						: {}),
				};
			}
			return {
				fn,
				resource,
				mode: "inline",
				data: migrateExpressionMap(obj.data as Record<string, string>),
				...(obj.id_destination
					? { id_destination: obj.id_destination as string }
					: {}),
			};
		}
		case "update": {
			const resource = obj.resource as string;
			const mode = obj.mode as "store" | "draft";
			if ("changes_path" in obj && obj.changes_path) {
				return {
					fn,
					resource,
					mode,
					filter: migrateExpressionMap(
						(obj.filter as Record<string, string>) ?? {},
					),
					changes_path: obj.changes_path as string,
				};
			}
			return {
				fn,
				resource,
				mode,
				...(mode === "store"
					? {
							filter: migrateExpressionMap(
								obj.filter as Record<string, string>,
							),
						}
					: {}),
				changes: migrateExpressionMap(
					obj.changes as Record<string, string>,
				),
			};
		}
		default:
			throw new Error(`Unknown action function: ${String(fn)}`);
	}
}

function migrateBranch(obj: Record<string, unknown>, path: string): string {
	const ast = structuredToAst(obj);
	const expression = serializeActionExpression(ast);
	console.log(`${path}: ${JSON.stringify(obj)} -> ${expression}`);
	return expression;
}

function walkNode(node: unknown, path: string): unknown {
	if (Array.isArray(node)) {
		return node.map((item, index) => walkNode(item, `${path}[${index}]`));
	}
	if (!node || typeof node !== "object") return node;

	const record = node as Record<string, unknown>;
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(record)) {
		const childPath = `${path}.${key}`;

		if ((key === "true" || key === "false") && isActionInvocation(value)) {
			result[key] = migrateBranch(value, childPath);
			continue;
		}

		result[key] = walkNode(value, childPath);
	}

	return result;
}

async function migrateFixture(relativePath: string): Promise<void> {
	const absolutePath = `${import.meta.dir}/../${relativePath}`;
	const original = await Bun.file(absolutePath).text();
	const parsed = JSON.parse(original) as unknown;
	const migrated = walkNode(parsed, relativePath);
	const output = `${JSON.stringify(migrated, null, "\t")}\n`;
	await Bun.write(absolutePath, output);
}

console.log("Migrating action branches and map values...\n");
for (const fixture of FIXTURES) {
	await migrateFixture(fixture);
}
console.log("\nDone.");
