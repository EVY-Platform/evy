import { describe, expect, it } from "bun:test";
import { nowIso, toNanoIso } from "evy-types/clock";

const NINE_DIGIT_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z$/;

describe("nowIso", () => {
	it("emits a nine-fractional-digit UTC ISO-8601 string", () => {
		expect(nowIso()).toMatch(NINE_DIGIT_ISO);
	});

	it("tracks wall clock within 5 seconds", () => {
		const parsed = new Date(nowIso()).getTime();
		expect(Math.abs(parsed - Date.now())).toBeLessThan(5000);
	});

	it("is strictly increasing under a tight loop", () => {
		const values: string[] = [];
		for (let i = 0; i < 10_000; i++) {
			values.push(nowIso());
		}
		for (let i = 1; i < values.length; i++) {
			expect(values[i] > values[i - 1]).toBe(true);
		}
	});
});

describe("toNanoIso", () => {
	it.each([
		["2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000000000Z"],
		["2026-01-01T00:00:00Z", "2026-01-01T00:00:00.000000000Z"],
		["2026-01-01T00:00:00.123456789Z", "2026-01-01T00:00:00.123456789Z"],
		["2026-01-01T10:00:00+05:30", "2026-01-01T04:30:00.000000000Z"],
	])("normalises %s to %s", (input, expected) => {
		expect(toNanoIso(input)).toBe(expected);
	});

	it("normalises offset-less input using the host local zone", () => {
		const input = "2026-01-01T00:00:00";
		const parsedMs = Date.parse(input);
		const expected = `${new Date(parsedMs).toISOString().slice(0, -1)}000000Z`;
		expect(toNanoIso(input)).toBe(expected);
	});

	it("returns unparseable input unchanged", () => {
		expect(toNanoIso("not-a-date")).toBe("not-a-date");
	});
});
