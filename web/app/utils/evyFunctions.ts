type FunctionOutput = {
	value: string;
	prefix?: string;
	suffix?: string;
};

const functionHandlers: Record<string, FunctionOutput | null> = {
	count: { value: "1" },
	length: { value: "1" },
	formatCurrency: { value: "1.00", prefix: "$" },
	formatDimension: { value: "100", suffix: "mm" },
	formatWeight: { value: "500", suffix: "g" },
	formatAddress: { value: "1 Main Street, 2000\nSydney, NSW" },
	buildCurrency: null,
	buildAddress: null,
};

export function callFunction(name: string): FunctionOutput | null {
	return functionHandlers[name] ?? null;
}
