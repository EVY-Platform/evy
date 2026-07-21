/**
 * Split a function-call argument string on top-level commas, respecting
 * quotes (with backslash escapes) and paren/bracket/brace nesting.
 * Single source of truth — datetime and action parsing both use this.
 */
export function splitFunctionArguments(argsString: string): string[] {
	if (!argsString.trim()) return [];

	const args: string[] = [];
	let current = "";
	let parenDepth = 0;
	let bracketDepth = 0;
	let braceDepth = 0;
	let inString: '"' | "'" | null = null;
	let previousChar = "";

	for (const char of argsString) {
		if (inString) {
			current += char;
			if (char === inString && previousChar !== "\\") {
				inString = null;
			}
			previousChar = char;
			continue;
		}

		if (char === '"' || char === "'") {
			inString = char;
			current += char;
			previousChar = char;
			continue;
		}

		if (char === "(") parenDepth++;
		if (char === ")") parenDepth--;
		if (char === "[") bracketDepth++;
		if (char === "]") bracketDepth--;
		if (char === "{") braceDepth++;
		if (char === "}") braceDepth--;

		if (
			char === "," &&
			parenDepth === 0 &&
			bracketDepth === 0 &&
			braceDepth === 0
		) {
			const trimmed = current.trim();
			if (trimmed) args.push(trimmed);
			current = "";
			previousChar = char;
			continue;
		}

		current += char;
		previousChar = char;
	}

	const trimmed = current.trim();
	if (trimmed) args.push(trimmed);
	return args;
}
