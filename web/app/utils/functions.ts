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

const fallbackDimensionOutput: EVYFunctionOutput = {
	value: "100",
	suffix: "mm",
};

const previewMockData = {
	item: {
		width: 23240,
		height: 1200,
		length: 500,
		dimensions: {
			width: 23240,
			height: 1200,
			length: 500,
		},
	},
	width: 23240,
	height: 1200,
	length: 500,
};

function resolveMockPath(path: string): unknown {
	return path.split(".").reduce<unknown>((current, part) => {
		if (!current || typeof current !== "object") return undefined;
		return (current as Record<string, unknown>)[part];
	}, previewMockData);
}

function formatDimensionMillimetres(mm: number): EVYFunctionOutput {
	if (mm > 1000) return { value: String(Math.trunc(mm / 1000)), suffix: "m" };
	if (mm > 100) return { value: String(Math.trunc(mm / 10)), suffix: "cm" };
	return { value: String(mm), suffix: "mm" };
}

function evyFormatDimension(
	args: string,
	context?: EVYFunctionContext,
): EVYFunctionOutput {
	const trimmedArgs = args.trim();
	if (!trimmedArgs) return fallbackDimensionOutput;

	const value =
		trimmedArgs === "$datum" ? context?.datum : resolveMockPath(trimmedArgs);
	const rawValue = value ?? trimmedArgs;
	const trimmedValue = String(rawValue)
		.trim()
		.replace(/^['"]|['"]$/g, "");
	if (!trimmedValue) return { value: "" };

	const mm = Number(trimmedValue);
	if (!Number.isInteger(mm)) return fallbackDimensionOutput;
	return formatDimensionMillimetres(mm);
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
