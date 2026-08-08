/**
 * Validator and editor parser for inline action expression strings (`{fn(arg, …)}`).
 * Storage is the expression string; this module parses to an AST for validation,
 * editor tooling, and conformance tests.
 *
 * Rules mirror EVYActionParser / EVYActionRunner on iOS: legal argument counts,
 * brace-wrapped object literals for maps, and store vs draft update modes.
 * Map values are carried as strings; value-position resolution happens at runtime.
 *
 * Pinned by types/grammar/conformance.json (`action-parse` vectors).
 */

import { splitFunctionArguments } from "./functionArgs";
import { isValidResourceRef } from "./resourceRef";
import { unwrapOptionalBraces } from "./unwrapBraces";

type ActionExpressionMap = Record<string, string>;

export const ACTION_FUNCTION_NAMES = [
	"close",
	"select_photo",
	"expand_photo",
	"delete_photo",
	"show",
	"expand_text",
	"highlight_required",
	"clear",
	"select",
	"copy_to_clipboard",
	"navigate",
	"create",
	"update",
] as const;

export type ActionFunctionName = (typeof ACTION_FUNCTION_NAMES)[number];

export type ActionExpressionAst =
	| { fn: "close" | "select_photo" | "expand_photo" | "delete_photo" }
	| { fn: "show" | "expand_text"; row_id: string }
	| { fn: "highlight_required"; field: string }
	| { fn: "clear"; binding: string }
	| { fn: "select"; value: string }
	| { fn: "copy_to_clipboard"; value: string }
	| {
			fn: "navigate";
			flow_id: string;
			page_id: string;
			query?: ActionExpressionMap;
	  }
	| { fn: "create"; resource: string; mode: "submit" }
	| {
			fn: "create";
			resource: string;
			mode: "inline";
			data: ActionExpressionMap;
			id_destination?: string;
	  }
	| {
			fn: "create";
			resource: string;
			mode: "from_path";
			data_path: string;
			id_destination?: string;
	  }
	| {
			fn: "update";
			resource: string;
			mode: "store";
			filter: ActionExpressionMap;
			changes: ActionExpressionMap;
	  }
	| {
			fn: "update";
			resource: string;
			mode: "store";
			filter: ActionExpressionMap;
			changes_path: string;
	  }
	| {
			fn: "update";
			resource: string;
			mode: "draft";
			changes: ActionExpressionMap;
	  }
	| {
			fn: "update";
			resource: string;
			mode: "draft";
			changes_path: string;
	  };

type ActionParseResult =
	| { ok: true; ast: ActionExpressionAst }
	| { ok: false; reason: string };

const ZERO_ARG_FUNCTIONS = new Set([
	"close",
	"select_photo",
	"expand_photo",
	"delete_photo",
]);
const ROW_TARGET_FUNCTIONS = new Set(["show", "expand_text"]);

function fail(reason: string): ActionParseResult {
	return { ok: false, reason };
}

function stripOptionalSurroundingQuotes(value: string): string {
	const trimmed = value.trim();
	if (
		trimmed.length >= 2 &&
		trimmed.startsWith('"') &&
		trimmed.endsWith('"')
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

/** Optional braces, then `name(args)`. */
function parseFunctionCall(
	rawBranch: string,
): { name: string; args: string } | null {
	let branch = rawBranch.trim();
	if (!branch.startsWith("{") || !branch.endsWith("}")) return null;
	branch = branch.slice(1, -1).trim();

	const parenIndex = branch.indexOf("(");
	if (parenIndex <= 0 || !branch.endsWith(")")) return null;
	const name = branch.slice(0, parenIndex).trim();
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return null;
	return { name, args: branch.slice(parenIndex + 1, -1).trim() };
}

function parsePlainTextObject(
	text: string,
	allowEmptyValues = false,
): ActionExpressionMap | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

	const inner = trimmed.slice(1, -1).trim();
	if (!inner) return {};

	const object: ActionExpressionMap = {};
	for (const pair of splitFunctionArguments(inner)) {
		const colonIndex = pair.indexOf(":");
		if (colonIndex === -1) return null;
		const key = pair.slice(0, colonIndex).trim();
		const value = pair.slice(colonIndex + 1).trim();
		if (!key) return null;
		if (!allowEmptyValues && !value) return null;
		object[key] = stripOptionalSurroundingQuotes(value);
	}
	return object;
}

type ObjectArgument =
	| { kind: "map"; map: ActionExpressionMap }
	| { kind: "path"; path: string };

function parseObjectArgument(text: string): ObjectArgument | null {
	const trimmed = text.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const map = parsePlainTextObject(trimmed);
		return map === null ? null : { kind: "map", map };
	}
	if (!trimmed) return null;
	return { kind: "path", path: trimmed };
}

function convertCreate(args: string[]): ActionParseResult {
	if (args.length < 2) return fail("create requires resource and data");
	const resource = args[0].trim();
	if (!isValidResourceRef(resource)) {
		return fail("create requires a service-prefixed resource ref");
	}

	const second = args[1].trim();
	if (second === "submit") {
		if (args.length !== 2) {
			return fail("create submit takes no further arguments");
		}
		return {
			ok: true,
			ast: { fn: "create", resource, mode: "submit" },
		};
	}

	const data = parseObjectArgument(args[1]);
	if (!data) return fail("create data is neither an object nor a path");

	let idDestination: string | undefined;
	if (args.length > 2) {
		idDestination = args[2].trim();
		if (!idDestination)
			return fail("create id destination must not be empty");
	}
	if (args.length > 3) return fail("create accepts at most 3 arguments");

	if (data.kind === "map") {
		return {
			ok: true,
			ast: {
				fn: "create",
				resource,
				mode: "inline",
				data: data.map,
				...(idDestination ? { id_destination: idDestination } : {}),
			},
		};
	}
	return {
		ok: true,
		ast: {
			fn: "create",
			resource,
			mode: "from_path",
			data_path: data.path,
			...(idDestination ? { id_destination: idDestination } : {}),
		},
	};
}

function convertUpdate(args: string[]): ActionParseResult {
	if (args.length < 3 || args.length > 4) {
		return fail("update takes 3 or 4 arguments");
	}
	const resource = args[0].trim();
	if (!isValidResourceRef(resource)) {
		return fail("update requires a service-prefixed resource ref");
	}

	const isDraft = args.length === 4;
	if (isDraft && args[3].trim() !== "draft") {
		return fail("update mode argument must be `draft`");
	}

	const filter = parsePlainTextObject(args[1]);
	if (filter === null) return fail("update filter must be an object");
	const filterKeys = Object.keys(filter).length;
	if (isDraft && filterKeys > 0) {
		return fail("a draft update must not carry a filter");
	}
	if (!isDraft && filterKeys === 0) {
		return fail("a store update requires a non-empty filter");
	}

	const changes = parseObjectArgument(args[2]);
	if (!changes)
		return fail("update changes are neither an object nor a path");
	if (changes.kind === "map" && Object.keys(changes.map).length === 0) {
		return fail("update changes must not be empty");
	}

	const mode = isDraft ? ("draft" as const) : ("store" as const);
	const changePart =
		changes.kind === "map"
			? { changes: changes.map }
			: { changes_path: changes.path };

	if (mode === "draft") {
		return {
			ok: true,
			ast: {
				fn: "update",
				resource,
				mode,
				...changePart,
			},
		};
	}
	return {
		ok: true,
		ast: {
			fn: "update",
			resource,
			mode,
			filter,
			...changePart,
		},
	};
}

function convertNavigate(args: string[]): ActionParseResult {
	if (args.length < 2) return fail("navigate requires flowId and pageId");
	if (args.length > 3) return fail("navigate accepts at most 3 arguments");

	const flowId = stripOptionalSurroundingQuotes(args[0]);
	const pageId = stripOptionalSurroundingQuotes(args[1]);
	if (!flowId || !pageId) return fail("navigate requires flowId and pageId");

	const rawQuery = args.length > 2 ? args[2].trim() : "";
	if (!rawQuery) {
		return {
			ok: true,
			ast: { fn: "navigate", flow_id: flowId, page_id: pageId },
		};
	}

	const query = parsePlainTextObject(rawQuery, true);
	if (query === null) return fail("navigate query must be an object");
	return {
		ok: true,
		ast: { fn: "navigate", flow_id: flowId, page_id: pageId, query },
	};
}

export function parseActionExpression(branch: string): ActionParseResult {
	const trimmed = branch.trim();
	if (!trimmed) return fail("empty branch");

	const call = parseFunctionCall(trimmed);
	if (!call) return fail("not a brace-wrapped function call");

	const args = call.args ? splitFunctionArguments(call.args) : [];

	if (ZERO_ARG_FUNCTIONS.has(call.name)) {
		if (args.length > 0) return fail(`${call.name} takes no arguments`);
		return {
			ok: true,
			ast: { fn: call.name } as ActionExpressionAst,
		};
	}

	if (ROW_TARGET_FUNCTIONS.has(call.name)) {
		if (args.length !== 1)
			return fail(`${call.name} takes exactly one row id`);
		const rowId = stripOptionalSurroundingQuotes(args[0]);
		if (!rowId) return fail(`${call.name} row id must not be empty`);
		return {
			ok: true,
			ast: { fn: call.name, row_id: rowId } as ActionExpressionAst,
		};
	}

	switch (call.name) {
		case "highlight_required": {
			if (args.length !== 1)
				return fail("highlight_required takes one field");
			const field = args[0].trim();
			if (!field)
				return fail("highlight_required field must not be empty");
			return {
				ok: true,
				ast: { fn: "highlight_required", field },
			};
		}
		case "clear": {
			if (args.length !== 1) return fail("clear takes one binding");
			const binding = stripOptionalSurroundingQuotes(
				unwrapOptionalBraces(args[0]),
			);
			if (!binding) return fail("clear binding must not be empty");
			// `update` requires a resource ref; `clear` requires the opposite
			// so it can never blank a synced record.
			if (isValidResourceRef(binding)) {
				return fail(
					"clear targets a draft binding, not a resource ref",
				);
			}
			return { ok: true, ast: { fn: "clear", binding } };
		}
		case "select": {
			if (args.length !== 1) return fail("select takes one value");
			const value = args[0].trim();
			if (!value) return fail("select value must not be empty");
			return { ok: true, ast: { fn: "select", value } };
		}
		case "copy_to_clipboard": {
			if (args.length !== 1)
				return fail("copy_to_clipboard takes one value");
			const value = args[0].trim();
			if (!value)
				return fail("copy_to_clipboard value must not be empty");
			return { ok: true, ast: { fn: "copy_to_clipboard", value } };
		}
		case "navigate":
			return convertNavigate(args);
		case "create":
			return convertCreate(args);
		case "update":
			return convertUpdate(args);
		default:
			return fail(`unknown action function \`${call.name}\``);
	}
}
