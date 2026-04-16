export type EVYFunctionOutput = {
	value: string;
	prefix?: string;
	suffix?: string;
};

/** Web intentionally returns doc-shaped placeholders; real formatting runs on iOS. */
export function evyCount(): EVYFunctionOutput {
	return { value: "1" };
}

export function evyLength(): EVYFunctionOutput {
	return { value: "1" };
}

export function evyFormatCurrency(): EVYFunctionOutput {
	return { value: "1.00", prefix: "$" };
}

export function evyFormatDimension(): EVYFunctionOutput {
	return { value: "100", suffix: "mm" };
}

export function evyFormatWeight(): EVYFunctionOutput {
	return { value: "500", suffix: "g" };
}

export function evyFormatAddress(): EVYFunctionOutput {
	return { value: "1 Main Street, 2000\nSydney, NSW" };
}

export function evyFormatDecimalStub(): EVYFunctionOutput {
	return { value: "20.04" };
}

export function evyFormatMetricLengthStub(): EVYFunctionOutput {
	return { value: "23.24", suffix: "m" };
}

export function evyFormatImperialLengthStub(): EVYFunctionOutput {
	return { value: "13.88", suffix: "ft" };
}

export function evyFormatDurationStub(): EVYFunctionOutput {
	return { value: "15 minutes" };
}

export function evyFormatDateStub(): EVYFunctionOutput {
	return { value: "01/19/2024" };
}

type Handler = (_args: string) => EVYFunctionOutput | null;

const functionHandlers: Record<string, Handler> = {
	count: evyCount,
	length: evyLength,
	formatCurrency: evyFormatCurrency,
	formatDimension: evyFormatDimension,
	formatWeight: evyFormatWeight,
	formatAddress: evyFormatAddress,
	formatDecimal: evyFormatDecimalStub,
	formatMetricLength: evyFormatMetricLengthStub,
	formatImperialLength: evyFormatImperialLengthStub,
	formatDuration: evyFormatDurationStub,
	formatDate: evyFormatDateStub,
	buildCurrency: () => null,
	buildAddress: () => null,
};

export function callFunction(
	name: string,
	_args = "",
): EVYFunctionOutput | null {
	const handler = functionHandlers[name];
	if (!handler) return null;
	return handler(_args);
}
