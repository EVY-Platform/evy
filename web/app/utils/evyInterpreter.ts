import { callFunction } from "./evyFunctions";

const FUNCTION_PATTERN = /\{([a-zA-Z_]+)\(([^)]*)\)\}/;
const PROPS_PATTERN = /\{(?!")[^}^"]*(?!")\}/;

function humanizeProp(prop: string): string {
	const lastSegment = prop.split(".").pop() ?? prop;
	return lastSegment.replace(/_/g, " ");
}

export function parseText(input: string): string {
	if (!input) return input;

	let text = input;
	let safety = 0;

	while (safety++ < 50) {
		const fnMatch = FUNCTION_PATTERN.exec(text);
		if (fnMatch) {
			const result = callFunction(fnMatch[1]);
			const resolved = result
				? `${result.prefix ?? ""}${result.value}${result.suffix ?? ""}`
				: "";
			text = text.replace(fnMatch[0], resolved);
			continue;
		}

		const propsMatch = PROPS_PATTERN.exec(text);
		if (propsMatch) {
			const inner = propsMatch[0].slice(1, -1);

			if (/[><=!]/.test(inner)) {
				text = text.replace(propsMatch[0], "");
				continue;
			}

			text = text.replace(propsMatch[0], humanizeProp(inner));
			continue;
		}

		break;
	}

	return text.replace(/\\n/g, "\n");
}
