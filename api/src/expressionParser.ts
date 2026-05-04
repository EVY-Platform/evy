const FUNCTION_CALL_PATTERN = /^([a-zA-Z_]+)\((.*)\)$/;
const COMPARISON_OPERATOR_TOKENS = new Set([">=", "<=", "==", "!=", ">", "<"]);
const LOGICAL_OPERATOR_TOKENS = new Set(["&&", "||"]);
const PARENTHESIS_TOKENS = new Set(["(", ")"]);

type QuoteChar = '"' | "'";
type ScanState = {
	parenDepth: number;
	bracketDepth: number;
	braceDepth: number;
	quote: QuoteChar | null;
	previousChar: string;
};

function createScanState(): ScanState {
	return {
		parenDepth: 0,
		bracketDepth: 0,
		braceDepth: 0,
		quote: null,
		previousChar: "",
	};
}

function isTopLevel(state: ScanState): boolean {
	return (
		state.parenDepth === 0 && state.bracketDepth === 0 && state.braceDepth === 0
	);
}

function isQuoteChar(char: string): char is QuoteChar {
	return char === '"' || char === "'";
}

function scanCharacter(state: ScanState, char: string): void {
	if (state.quote) {
		if (char === state.quote && state.previousChar !== "\\") {
			state.quote = null;
		}
		state.previousChar = char;
		return;
	}

	if (isQuoteChar(char)) {
		state.quote = char;
	} else if (char === "(") {
		state.parenDepth++;
	} else if (char === ")") {
		state.parenDepth--;
	} else if (char === "[") {
		state.bracketDepth++;
	} else if (char === "]") {
		state.bracketDepth--;
	} else if (char === "{") {
		state.braceDepth++;
	} else if (char === "}") {
		state.braceDepth--;
	}

	state.previousChar = char;
}

export function extractBindingsFromString(text: string): string[] {
	const bindings: string[] = [];
	let bindingBody = "";
	let bindingState: ScanState | null = null;

	for (const char of text) {
		if (!bindingState) {
			if (char === "{") {
				bindingState = createScanState();
				bindingState.braceDepth = 1;
				bindingBody = "";
			}
			continue;
		}

		scanCharacter(bindingState, char);
		if (bindingState.braceDepth === 0) {
			const trimmedBindingBody = bindingBody.trim();
			if (trimmedBindingBody) {
				bindings.push(trimmedBindingBody);
			}
			bindingState = null;
			bindingBody = "";
			continue;
		}

		bindingBody += char;
	}

	return bindings;
}

export function extractCandidatesFromBinding(bindingBody: string): string[] {
	const trimmedBindingBody = bindingBody.trim();
	if (!trimmedBindingBody) {
		return [];
	}

	if (trimmedBindingBody.startsWith("$api:")) {
		return uniqueCandidates(
			extractCandidatesFromApiSourceBinding(trimmedBindingBody),
		);
	}

	if (isExcludedBinding(trimmedBindingBody)) {
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

function isExcludedBinding(bindingBody: string): boolean {
	return bindingBody.startsWith("$local:") || bindingBody.startsWith("$datum:");
}

function extractCandidatesFromApiSourceBinding(bindingBody: string): string[] {
	const paramsText = extractApiSourceParamsText(bindingBody);
	return paramsText ? extractInterpolatedKeysFromParamObject(paramsText) : [];
}

function extractApiSourceParamsText(value: string): string | null {
	const trimmedValue = value.trim();
	if (!trimmedValue.endsWith(")")) {
		return null;
	}

	const openParenIndex = topLevelCharacterIndex(trimmedValue, "(", "last");
	return openParenIndex === -1
		? null
		: trimmedValue.slice(openParenIndex + 1, -1).trim();
}

function extractInterpolatedKeysFromParamObject(value: string): string[] {
	const trimmedValue = value.trim();
	if (!trimmedValue.startsWith("{") || !trimmedValue.endsWith("}")) {
		return [];
	}

	const objectBody = trimmedValue.slice(1, -1);
	const candidates: string[] = [];
	for (const entry of splitFunctionArguments(objectBody)) {
		if (topLevelCharacterIndex(entry, ":") !== -1) {
			continue;
		}
		const candidate = unquote(entry.trim());
		if (isCandidate(candidate)) {
			candidates.push(candidate);
		}
	}
	return candidates;
}

function topLevelCharacterIndex(
	value: string,
	targetCharacter: string,
	mode: "first" | "last" = "first",
): number {
	const state = createScanState();
	let foundIndex = -1;

	for (let index = 0; index < value.length; index++) {
		const char = value[index] ?? "";
		if (!state.quote && char === targetCharacter && isTopLevel(state)) {
			if (mode === "first") {
				return index;
			}
			foundIndex = index;
		}
		scanCharacter(state, char);
	}

	return isTopLevel(state) ? foundIndex : -1;
}

function unquote(value: string): string {
	if (isStringLiteral(value)) {
		return value.slice(1, -1);
	}
	return value;
}

function tokenize(input: string): string[] {
	const tokens: string[] = [];
	let index = 0;

	while (index < input.length) {
		const currentChar = input[index];

		if (isWhitespace(currentChar)) {
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
			COMPARISON_OPERATOR_TOKENS.has(twoCharOperator) ||
			LOGICAL_OPERATOR_TOKENS.has(twoCharOperator)
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
			const balancedToken = readBalancedToken(input, index);
			word += balancedToken.text;
			index = balancedToken.nextIndex;

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

function readBalancedToken(
	input: string,
	startIndex: number,
): { text: string; nextIndex: number } {
	const state = createScanState();
	let text = "";
	let index = startIndex;

	while (index < input.length) {
		const char = input[index] ?? "";
		text += char;
		scanCharacter(state, char);
		index++;
		if (text.length > 1 && isTopLevel(state)) {
			break;
		}
	}

	return { text, nextIndex: index };
}

function isFunctionCall(value: string): boolean {
	return FUNCTION_CALL_PATTERN.test(value);
}

function extractFunctionArgs(functionCall: string): string[] {
	const match = functionCall.match(FUNCTION_CALL_PATTERN);
	if (!match) {
		return [];
	}
	return splitFunctionArguments(match[2] ?? "");
}

function rootSegment(path: string): string {
	const withoutArrayAccessor = path.replace(/\[[^\]]*\]/g, "");
	const [root] = withoutArrayAccessor.split(".");
	return root ?? "";
}

function isNumericLiteral(value: string): boolean {
	return /^-?\d+(\.\d+)?$/.test(value);
}

function isUuidLike(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value,
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

		if (isQueryObjectArgument(trimmedArg)) {
			candidates.push(...extractCandidatesFromQueryObjectArgument(trimmedArg));
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
	return splitTopLevel(args, ",");
}

function splitTopLevel(value: string, separator: string): string[] {
	const components: string[] = [];
	const state = createScanState();
	let current = "";

	for (let index = 0; index < value.length; index++) {
		const char = value[index] ?? "";
		if (!state.quote && char === separator && isTopLevel(state)) {
			const trimmedCurrent = current.trim();
			if (trimmedCurrent) {
				components.push(trimmedCurrent);
			}
			current = "";
			continue;
		}

		current += char;
		scanCharacter(state, char);
	}

	const trimmedCurrent = current.trim();
	if (trimmedCurrent) {
		components.push(trimmedCurrent);
	}

	return components;
}

function isQueryObjectArgument(value: string): boolean {
	const trimmedValue = value.trim();
	return trimmedValue.startsWith("{") && trimmedValue.endsWith("}");
}

function extractCandidatesFromQueryObjectArgument(value: string): string[] {
	const candidates: string[] = [];
	const keyPattern = /["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*:/g;
	for (const match of value.matchAll(keyPattern)) {
		const candidate = match[1] ?? "";
		if (isCandidate(candidate)) {
			candidates.push(candidate);
		}
	}
	return candidates;
}

function candidateFromValue(value: string): string {
	if (shouldSkipLiteralOrUuid(value)) {
		return "";
	}
	return rootSegment(value);
}

function isCandidate(value: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function shouldSkipExpressionToken(token: string): boolean {
	return (
		!token ||
		COMPARISON_OPERATOR_TOKENS.has(token) ||
		LOGICAL_OPERATOR_TOKENS.has(token) ||
		PARENTHESIS_TOKENS.has(token) ||
		shouldSkipLiteralOrUuid(token)
	);
}

function shouldSkipLiteralOrUuid(value: string): boolean {
	return (
		isNumericLiteral(value) ||
		isUuidLike(value) ||
		isStringLiteral(value) ||
		value === "true" ||
		value === "false" ||
		value === "null"
	);
}

function containsComparisonOperator(value: string): boolean {
	return [...COMPARISON_OPERATOR_TOKENS].some((op) => value.includes(op));
}

function startsWithOperator(input: string, index: number): boolean {
	const twoChar = input.slice(index, index + 2);
	const oneChar = input[index] ?? "";
	return (
		LOGICAL_OPERATOR_TOKENS.has(twoChar) ||
		COMPARISON_OPERATOR_TOKENS.has(twoChar) ||
		COMPARISON_OPERATOR_TOKENS.has(oneChar)
	);
}

function isWhitespace(value: string | undefined): boolean {
	return value === " " || value === "\t" || value === "\n";
}

function isStringLiteral(value: string): boolean {
	return (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	);
}

function uniqueCandidates(candidates: string[]): string[] {
	return [...new Set(candidates)];
}
