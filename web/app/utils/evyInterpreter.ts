import { callFunction } from "./evyFunctions";

const FUNCTION_WITH_BRACES = /\{([a-zA-Z_]+)\(([^)]*)\)\}/;
const PROPS_PATTERN = /\{(?!")[^}^"]*(?!")\}/;

function resolveFunction(match: string): string | null {
	const fnMatch = match.match(/^\{([a-zA-Z_]+)\(([^)]*)\)\}$/);
	if (!fnMatch) return null;

	const functionName = fnMatch[1];
	const result = callFunction(functionName);
	if (!result) return "";

	return `${result.prefix ?? ""}${result.value}${result.suffix ?? ""}`;
}

function propToUserFriendlyString(prop: string): string {
	const lastSegment = prop.split(".").pop() ?? prop;
	return lastSegment.replace(/_/g, " ");
}

export function parseText(input: string): string {
	if (!input) return input;

	let text = input;
	let safety = 0;

	while (safety++ < 50) {
		const fnMatch = FUNCTION_WITH_BRACES.exec(text);
		if (fnMatch) {
			const resolved = resolveFunction(fnMatch[0]);
			if (resolved !== null) {
				text = text.replace(fnMatch[0], resolved);
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

			text = text.replace(propsMatch[0], propToUserFriendlyString(inner));
			continue;
		}

		break;
	}

	return text.replace(/\\n/g, "\n");
}
