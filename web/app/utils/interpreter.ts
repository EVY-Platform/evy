import { callFunction, type EVYFunctionContext } from "./functions";
import { formatResourcePathForDisplay } from "./resourcePathDisplay";

const FUNCTION_CALL_PATTERN = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^()]*)\)/;
const PROPS_PATTERN = /\{(?!")[^}^"]*(?!")\}/;

function resolveFunction(
	functionName: string,
	args: string,
	context?: EVYFunctionContext,
): string | null {
	const result = callFunction(functionName, args, context);
	if (!result) return "";
	return `${result.prefix ?? ""}${result.value}${result.suffix ?? ""}`;
}

function replaceFunctionCall(
	text: string,
	match: RegExpExecArray,
	resolved: string,
): string {
	const matchStart = match.index;
	const matchEnd = matchStart + match[0].length;
	return `${text.slice(0, matchStart)}${resolved}${text.slice(matchEnd)}`;
}

export function parseText(
	input: string,
	context?: EVYFunctionContext,
	resourceIdToEntityName: Map<string, string> = new Map(),
): string {
	if (!input) return input;

	let text = input;
	let safety = 0;

	while (safety++ < 50) {
		const fnMatch = FUNCTION_CALL_PATTERN.exec(text);
		if (fnMatch) {
			const resolved = resolveFunction(fnMatch[1], fnMatch[2], context);
			if (resolved !== null) {
				text = replaceFunctionCall(text, fnMatch, resolved);
				continue;
			}
		}

		const propsMatch = PROPS_PATTERN.exec(text);
		if (propsMatch) {
			const inner = propsMatch[0].slice(1, -1);

			if (/[><=!]/.test(inner)) {
				text = text.replace(propsMatch[0], "");
				continue;
			}

			text = text.replace(
				propsMatch[0],
				formatResourcePathForDisplay(inner, resourceIdToEntityName),
			);
			continue;
		}

		break;
	}

	return text.replace(/\\n/g, "\n");
}
