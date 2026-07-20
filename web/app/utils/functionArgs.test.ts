import { describe, expect, it } from "bun:test";
import { splitFunctionArguments } from "./functionArgs";

describe("splitFunctionArguments", () => {
	it("splits plain arguments and trims whitespace", () => {
		expect(splitFunctionArguments("a, b ,c")).toEqual(["a", "b", "c"]);
	});

	it("returns an empty array for blank input", () => {
		expect(splitFunctionArguments("")).toEqual([]);
		expect(splitFunctionArguments("   ")).toEqual([]);
	});

	it("keeps commas inside quotes (datetime pattern shape)", () => {
		expect(
			splitFunctionArguments(
				'"2026-06-03T09:30:00.000Z", "EEE d, HH:mm"',
			),
		).toEqual(['"2026-06-03T09:30:00.000Z"', '"EEE d, HH:mm"']);
	});

	it("respects escaped quotes inside strings", () => {
		expect(splitFunctionArguments('"a\\"b", c')).toEqual(['"a\\"b"', "c"]);
	});

	it("keeps commas inside nested calls and brackets", () => {
		expect(
			splitFunctionArguments("findFirst(items, item.id), [1, 2], {a, b}"),
		).toEqual(["findFirst(items, item.id)", "[1, 2]", "{a, b}"]);
	});
});
