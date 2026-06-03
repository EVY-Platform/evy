import { evyFormatDatetime } from "./datetime";

export type EVYFunctionContext = {
	datum?: string;
};

export type EVYFunctionOutput = {
	value: string;
	prefix?: string;
	suffix?: string;
};

type EVYFunctionHandler = (
	args: string,
	context?: EVYFunctionContext,
) => EVYFunctionOutput | null;

/** Web intentionally returns doc-shaped placeholders for functions that need runtime data. */
function evyCount(): EVYFunctionOutput {
	return { value: "1" };
}

function evyLength(): EVYFunctionOutput {
	return { value: "1" };
}

function evyFormatCurrency(): EVYFunctionOutput {
	return { value: "1.00", prefix: "$" };
}

function evyFormatDimension(): EVYFunctionOutput {
	return { value: "100", suffix: "mm" };
}

function evyFormatWeight(): EVYFunctionOutput {
	return { value: "500", suffix: "g" };
}

function evyFormatAddress(): EVYFunctionOutput {
	return { value: "1 Main Street, 2000\nSydney, NSW" };
}

const evyFormatDecimalStub = (): EVYFunctionOutput => ({ value: "20.04" });
const evyFormatMetricLengthStub = (): EVYFunctionOutput => ({
	value: "23.24",
	suffix: "m",
});
const evyFormatImperialLengthStub = (): EVYFunctionOutput => ({
	value: "13.88",
	suffix: "ft",
});
const evyFormatDurationStub = (): EVYFunctionOutput => ({
	value: "15 minutes",
});

const functionHandlers: Record<string, EVYFunctionHandler> = {
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
	formatDatetime: evyFormatDatetime,
};

export function callFunction(
	name: string,
	args = "",
	context?: EVYFunctionContext,
): EVYFunctionOutput | null {
	const handler = functionHandlers[name];
	if (!handler) return null;
	return handler(args, context);
}
