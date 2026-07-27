import { describe, expect, test } from "bun:test";

import {
	findInterpolationRegions,
	isRangeInsideRegions,
} from "./interpolationRegions";

describe("findInterpolationRegions", () => {
	test("returns nothing for text without braces", () => {
		expect(findInterpolationRegions("No messages found")).toEqual([]);
	});

	test("returns the interior of a single interpolation", () => {
		expect(findInterpolationRegions("Total: {res-1.price}")).toEqual([
			{ start: 8, end: 19 },
		]);
	});

	test("returns every top-level interpolation", () => {
		expect(findInterpolationRegions("{a} and {b}")).toEqual([
			{ start: 1, end: 2 },
			{ start: 9, end: 10 },
		]);
	});

	test("treats an unterminated interpolation as running to the end", () => {
		expect(findInterpolationRegions("Total: {res-1")).toEqual([
			{ start: 8, end: 13 },
		]);
	});

	test("collapses nested braces into the outermost region", () => {
		expect(findInterpolationRegions("{fk: {a: b}}")).toEqual([
			{ start: 1, end: 11 },
		]);
	});

	test("ignores a closing brace with no opener", () => {
		expect(findInterpolationRegions("} {a}")).toEqual([
			{ start: 3, end: 4 },
		]);
	});
});

describe("isRangeInsideRegions", () => {
	const regions = findInterpolationRegions("Filter messages by {messages}");

	test("accepts a range contained by a region", () => {
		expect(isRangeInsideRegions(regions, 20, 28)).toBe(true);
	});

	test("rejects a range outside every region", () => {
		expect(isRangeInsideRegions(regions, 7, 15)).toBe(false);
	});

	test("rejects a range straddling the closing brace", () => {
		expect(isRangeInsideRegions(regions, 20, 29)).toBe(false);
	});

	test("rejects everything when there are no regions", () => {
		expect(isRangeInsideRegions([], 0, 1)).toBe(false);
	});
});
