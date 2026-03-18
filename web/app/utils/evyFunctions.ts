export type EVYFunctionOutput = {
	value: string;
	prefix?: string;
	suffix?: string;
};

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

const functionHandlers: Record<string, () => EVYFunctionOutput | null> = {
	count: evyCount,
	length: evyLength,
	formatCurrency: evyFormatCurrency,
	formatDimension: evyFormatDimension,
	formatWeight: evyFormatWeight,
	formatAddress: evyFormatAddress,
	buildCurrency: () => null,
	buildAddress: () => null,
};

export function callFunction(name: string): EVYFunctionOutput | null {
	const handler = functionHandlers[name];
	if (!handler) return null;
	return handler();
}
