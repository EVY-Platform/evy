const BRACED_BINDING_PATTERN = /\{([^}]+)\}/g;
const FUNCTION_CALL_PATTERN = /^([a-zA-Z_]+)\((.*)\)$/;
const COMPARISON_OPERATOR_TOKENS = new Set([">=", "<=", "==", "!=", ">", "<"]);
const LOGICAL_OPERATOR_TOKENS = new Set(["&&", "||"]);
const PARENTHESIS_TOKENS = new Set(["(", ")"]);

export function extractBindingsFromString(text: string): string[] {
	const bindings: string[] = [];
	for (const match of text.matchAll(BRACED_BINDING_PATTERN)) {
		const bindingBody = match[1]?.trim();
		if (bindingBody) {
			bindings.push(bindingBody);
		}
	}
	return bindings;
}

export function extractCandidatesFromBinding(bindingBody: string): string[] {
	const trimmedBindingBody = bindingBody.trim();
	if (!trimmedBindingBody || isExcludedBinding(trimmedBindingBody)) {
		return [];
	}

	if (containsComparisonOperator(trimmedBindingBody)) {
		return uniqueCandidates(
			extractCandidatesFromExpression(trimmedBindingBody),
		);
	}

	if (isFunctionCall(trimmedBindingBody)) {
		return uniqueCandidates(
			extractCandidatesFromFunctionCall(trimmedBindingBody),
		);
	}

	return uniqueCandidates(
		[candidateFromValue(trimmedBindingBody)].filter(isCandidate),
	);
}

export function isExcludedBinding(bindingBody: string): boolean {
	const trimmedBindingBody = bindingBody.trim();
	return (
		trimmedBindingBody.startsWith("$api:") ||
		trimmedBindingBody.startsWith("$local:") ||
		trimmedBindingBody.startsWith("$datum:")
	);
}

export function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let index = 0;

	while (index < input.length) {
		const currentChar = input[index];

		if (currentChar === " " || currentChar === "\t" || currentChar === "\n") {
			index++;
			continue;
		}

		if (currentChar === "(" || currentChar === ")") {
			tokens.push(currentChar);
			index++;
			continue;
		}

		const twoCharOperator = input.slice(index, index + 2);
		if (
			twoCharOperator === "&&" ||
			twoCharOperator === "||" ||
			twoCharOperator === ">=" ||
			twoCharOperator === "<=" ||
			twoCharOperator === "!=" ||
			twoCharOperator === "=="
		) {
			tokens.push(twoCharOperator);
			index += 2;
			continue;
		}

		if (currentChar === ">" || currentChar === "<") {
			tokens.push(currentChar);
			index++;
			continue;
		}

		let word = "";
		while (
			index < input.length &&
			!isWhitespace(input[index]) &&
			input[index] !== "(" &&
			input[index] !== ")" &&
			!startsWithOperator(input, index)
		) {
			word += input[index];
			index++;
		}

		if (index < input.length && input[index] === "(") {
			word += input[index];
			index++;

			let depth = 1;
			let inString = false;
			while (index < input.length && depth > 0) {
				const char = input[index];

				if (inString) {
					word += char;
					if (char === '"') {
						inString = false;
					}
					index++;
					continue;
				}

				if (char === '"') {
					inString = true;
				} else if (char === "(") {
					depth++;
				} else if (char === ")") {
					depth--;
				}

				word += char;
				index++;
			}

			if (word) {
				tokens.push(word);
			}
			continue;
		}

		if (word) {
			tokens.push(word);
			continue;
		}

		index++;
	}

	return tokens;
}

export function isFunctionCall(value: string): boolean {
	return FUNCTION_CALL_PATTERN.test(value.trim());
}

export function extractFunctionArgs(functionCall: string): string[] {
	const match = functionCall.trim().match(FUNCTION_CALL_PATTERN);
	if (!match) {
		return [];
	}
	return splitFunctionArguments(match[2] ?? "");
}

export function rootSegment(path: string): string {
	const withoutArrayAccessor = path.trim().replace(/\[[^\]]*\]/g, "");
	const [root] = withoutArrayAccessor.split(".");
	return root?.trim() ?? "";
}

export function isNumericLiteral(value: string): boolean {
	return /^-?\d+(\.\d+)?$/.test(value.trim());
}

export function isUuidLike(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value.trim(),
	);
}

function extractCandidatesFromExpression(expression: string): string[] {
	const candidates: string[] = [];
	for (const token of tokenize(expression)) {
		if (shouldSkipExpressionToken(token)) {
			continue;
		}

		if (isFunctionCall(token)) {
			candidates.push(...extractCandidatesFromFunctionCall(token));
			continue;
		}

		const candidate = candidateFromValue(token);
		if (isCandidate(candidate)) {
			candidates.push(candidate);
		}
	}
	return candidates;
}

function extractCandidatesFromFunctionCall(functionCall: string): string[] {
	const candidates: string[] = [];
	for (const arg of extractFunctionArgs(functionCall)) {
		const trimmedArg = arg.trim();

		if (!trimmedArg || shouldSkipLiteralOrUuid(trimmedArg)) {
			continue;
		}

		if (isFunctionCall(trimmedArg)) {
			candidates.push(...extractCandidatesFromFunctionCall(trimmedArg));
			continue;
		}

		const candidate = candidateFromValue(trimmedArg);
		if (isCandidate(candidate)) {
			candidates.push(candidate);
		}
	}
	return candidates;
}

function splitFunctionArguments(args: string): string[] {
	const components: string[] = [];
	let current = "";
	let depth = 0;
	let inString = false;

	for (const char of args) {
		if (inString) {
			current += char;
			if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
			current += char;
			continue;
		}

		if (char === "(") {
			depth++;
			current += char;
			continue;
		}

		if (char === ")") {
			depth--;
			current += char;
			continue;
		}

		if (char === "," && depth === 0) {
			const trimmedCurrent = current.trim();
			if (trimmedCurrent) {
				components.push(trimmedCurrent);
			}
			current = "";
			continue;
		}

		current += char;
	}

	const trimmedCurrent = current.trim();
	if (trimmedCurrent) {
		components.push(trimmedCurrent);
	}

	return components;
}

function candidateFromValue(value: string): string {
	const trimmedValue = value.trim();
	if (shouldSkipLiteralOrUuid(trimmedValue)) {
		return "";
	}
	return rootSegment(trimmedValue);
}

function isCandidate(value: string): value is string {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function shouldSkipExpressionToken(token: string): boolean {
	const trimmedToken = token.trim();
	return (
		!trimmedToken ||
		COMPARISON_OPERATOR_TOKENS.has(trimmedToken) ||
		LOGICAL_OPERATOR_TOKENS.has(trimmedToken) ||
		PARENTHESIS_TOKENS.has(trimmedToken) ||
		shouldSkipLiteralOrUuid(trimmedToken)
	);
}

function shouldSkipLiteralOrUuid(value: string): boolean {
	const trimmedValue = value.trim();
	return (
		isNumericLiteral(trimmedValue) ||
		isUuidLike(trimmedValue) ||
		isStringLiteral(trimmedValue) ||
		trimmedValue === "true" ||
		trimmedValue === "false" ||
		trimmedValue === "null"
	);
}

function containsComparisonOperator(value: string): boolean {
	return /[><=!]/.test(value);
}

function startsWithOperator(input: string, index: number): boolean {
	const twoCharOperator = input.slice(index, index + 2);
	return (
		twoCharOperator === "&&" ||
		twoCharOperator === "||" ||
		twoCharOperator === ">=" ||
		twoCharOperator === "<=" ||
		twoCharOperator === "!=" ||
		twoCharOperator === "==" ||
		input[index] === ">" ||
		input[index] === "<"
	);
}

function isWhitespace(value: string | undefined): boolean {
	return value === " " || value === "\t" || value === "\n";
}

function isStringLiteral(value: string): boolean {
	const trimmedValue = value.trim();
	return (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	);
}

function uniqueCandidates(candidates: string[]): string[] {
	return [...new Set(candidates)];
}
