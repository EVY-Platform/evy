/**
 * Converts legacy `{fn(arg,arg)}` action branch strings into structured
 * UI_ActionInvocation objects.
 *
 * The rules here mirror EVYActionParser / EVYActionRunner on iOS exactly,
 * including the quirks: which argument counts are legal, which arguments must
 * be brace-wrapped objects, and that a store update needs a non-empty filter
 * while a draft update needs an empty one. Value expressions are carried across
 * unchanged as strings, because whether a bare word is a data path or a literal
 * is decided at execution time against live data.
 *
 * Conversions are pinned by the shared corpus (types/grammar/conformance.json),
 * so a divergence between this and the clients fails a named test.
 */

import { splitFunctionArguments } from "./functionArgs";
import type {
	UI_ActionExpressionMap,
	UI_ActionInvocation,
} from "./generated/ts/sdui/action";
import { isValidResourceRef } from "./resourceRef";

type ActionConversion =
	| { ok: true; invocation: UI_ActionInvocation }
	| { ok: false; reason: string };

const ZERO_ARG_FUNCTIONS = new Set([
	"close",
	"select_photo",
	"expand_photo",
	"delete_photo",
]);
const ROW_TARGET_FUNCTIONS = new Set(["show", "expand_text"]);

function fail(reason: string): ActionConversion {
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

/** Mirrors EVYActionParser.functionCall: optional braces, then `name(args)`. */
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

/** Mirrors EVYActionParser.plainTextObject, splitting each pair on its first colon. */
function parsePlainTextObject(
	text: string,
	allowEmptyValues = false,
): UI_ActionExpressionMap | null {
	const trimmed = text.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

	const inner = trimmed.slice(1, -1).trim();
	if (!inner) return {};

	const object: UI_ActionExpressionMap = {};
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
	| { kind: "map"; map: UI_ActionExpressionMap }
	| { kind: "path"; path: string };

/** Brace-wrapped means an inline map; anything else non-empty is a data path. */
function parseObjectArgument(text: string): ObjectArgument | null {
	const trimmed = text.trim();
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		const map = parsePlainTextObject(trimmed);
		return map === null ? null : { kind: "map", map };
	}
	if (!trimmed) return null;
	return { kind: "path", path: trimmed };
}

function convertCreate(args: string[]): ActionConversion {
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
			invocation: { fn: "create", resource, mode: "submit" },
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
			invocation: {
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
		invocation: {
			fn: "create",
			resource,
			mode: "from_path",
			data_path: data.path,
			...(idDestination ? { id_destination: idDestination } : {}),
		},
	};
}

function convertUpdate(args: string[]): ActionConversion {
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
			invocation: {
				fn: "update",
				resource,
				mode,
				...changePart,
			},
		};
	}
	return {
		ok: true,
		invocation: {
			fn: "update",
			resource,
			mode,
			filter,
			...changePart,
		},
	};
}

function convertNavigate(args: string[]): ActionConversion {
	if (args.length < 2) return fail("navigate requires flowId and pageId");
	if (args.length > 3) return fail("navigate accepts at most 3 arguments");

	const flowId = stripOptionalSurroundingQuotes(args[0]);
	const pageId = stripOptionalSurroundingQuotes(args[1]);
	if (!flowId || !pageId) return fail("navigate requires flowId and pageId");

	const rawQuery = args.length > 2 ? args[2].trim() : "";
	if (!rawQuery) {
		return {
			ok: true,
			invocation: { fn: "navigate", flow_id: flowId, page_id: pageId },
		};
	}

	const query = parsePlainTextObject(rawQuery, true);
	if (query === null) return fail("navigate query must be an object");
	return {
		ok: true,
		invocation: { fn: "navigate", flow_id: flowId, page_id: pageId, query },
	};
}

/** Empty branches stay empty; `{ ok: false }` means "leave this string alone". */
export function parseActionStringToInvocation(
	branch: string,
): ActionConversion {
	const trimmed = branch.trim();
	if (!trimmed) return fail("empty branch");

	const call = parseFunctionCall(trimmed);
	if (!call) return fail("not a brace-wrapped function call");

	const args = call.args ? splitFunctionArguments(call.args) : [];

	if (ZERO_ARG_FUNCTIONS.has(call.name)) {
		if (args.length > 0) return fail(`${call.name} takes no arguments`);
		return {
			ok: true,
			invocation: { fn: call.name } as UI_ActionInvocation,
		};
	}

	if (ROW_TARGET_FUNCTIONS.has(call.name)) {
		if (args.length !== 1)
			return fail(`${call.name} takes exactly one row id`);
		const rowId = stripOptionalSurroundingQuotes(args[0]);
		if (!rowId) return fail(`${call.name} row id must not be empty`);
		return {
			ok: true,
			invocation: { fn: call.name, row_id: rowId } as UI_ActionInvocation,
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
				invocation: { fn: "highlight_required", field },
			};
		}
		case "select": {
			if (args.length !== 1) return fail("select takes one value");
			const value = args[0].trim();
			if (!value) return fail("select value must not be empty");
			return { ok: true, invocation: { fn: "select", value } };
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

function serializeExpressionMap(map: UI_ActionExpressionMap): string {
	const pairs = Object.entries(map).map(([key, value]) => `${key}: ${value}`);
	return `{${pairs.join(", ")}}`;
}

/**
 * Round-trips an invocation back to its editor string for the web action editor.
 */
export function serializeInvocationToEditorString(
	invocation: UI_ActionInvocation,
): string {
	const call = (args: string[]) => `{${invocation.fn}(${args.join(",")})}`;

	switch (invocation.fn) {
		case "close":
		case "select_photo":
		case "expand_photo":
		case "delete_photo":
			return `{${invocation.fn}()}`;
		case "show":
		case "expand_text":
			return call([invocation.row_id]);
		case "highlight_required":
			return call([invocation.field]);
		case "select":
			return call([invocation.value]);
		case "navigate":
			return call([
				invocation.flow_id,
				invocation.page_id,
				...(invocation.query
					? [serializeExpressionMap(invocation.query)]
					: []),
			]);
		case "create": {
			if (invocation.mode === "submit") {
				return call([invocation.resource, "submit"]);
			}
			const dataArg =
				invocation.mode === "inline"
					? serializeExpressionMap(invocation.data)
					: invocation.data_path;
			return call([
				invocation.resource,
				dataArg,
				...(invocation.id_destination
					? [invocation.id_destination]
					: []),
			]);
		}
		case "update": {
			const filterArg =
				"filter" in invocation && invocation.filter
					? serializeExpressionMap(invocation.filter)
					: "{}";
			const changesArg =
				"changes" in invocation && invocation.changes
					? serializeExpressionMap(invocation.changes)
					: (invocation as { changes_path: string }).changes_path;
			return call([
				invocation.resource,
				filterArg,
				changesArg,
				...(invocation.mode === "draft" ? ["draft"] : []),
			]);
		}
	}
}
