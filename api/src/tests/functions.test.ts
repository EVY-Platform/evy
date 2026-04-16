import { describe, expect, test } from "bun:test";
import {
	formatDateIso,
	formatDecimal,
	formatDurationMs,
	formatImperialLengthMm,
	formatMetricLengthMm,
	splitFunctionArguments,
	stripOptionalSurroundingQuotes,
} from "../functions";

describe("splitFunctionArguments", () => {
	test("splits simple comma args", () => {
		expect(splitFunctionArguments("item.price, 2")).toEqual([
			"item.price",
			"2",
		]);
	});

	test("keeps quoted commas inside a segment", () => {
		expect(splitFunctionArguments(`item.date, "MM/dd/yyyy"`)).toEqual([
			"item.date",
			`"MM/dd/yyyy"`,
		]);
	});
});

describe("stripOptionalSurroundingQuotes", () => {
	test("strips double quotes", () => {
		expect(stripOptionalSurroundingQuotes(`"MM/dd/yyyy"`)).toBe("MM/dd/yyyy");
	});
});

describe("formatDecimal", () => {
	test("rounds half away from zero to fraction digits", () => {
		expect(formatDecimal(20.0423, 2)).toBe("20.04");
	});
});

describe("length formatters", () => {
	test("metric length matches docs example", () => {
		expect(formatMetricLengthMm(23240)).toBe("23.24m");
	});

	test("imperial length matches docs example", () => {
		expect(formatImperialLengthMm(4231)).toBe("13.88ft");
	});
});

describe("formatDurationMs", () => {
	test("humanizes doc example", () => {
		expect(formatDurationMs(900_000)).toBe("15 minutes");
	});
});

describe("formatDateIso", () => {
	test("formats UTC calendar date from ISO string", () => {
		expect(formatDateIso("2024-01-19T12:42:52.000Z", "MM/dd/yyyy")).toBe(
			"01/19/2024",
		);
	});

	test("accepts YYYY/DD style patterns from docs", () => {
		expect(formatDateIso("2024-01-19T12:42:52.000Z", "MM/DD/YYYY")).toBe(
			"01/19/2024",
		);
	});
});
