import { describe, expect, it } from "bun:test";

import { parseText } from "./interpreter";

describe("parseText", () => {
	it("resolves count function placeholder", () => {
		expect(parseText("Items: {count()}")).toContain("1");
	});

	it("resolves formatCurrency placeholder", () => {
		expect(parseText("{formatCurrency()}")).toContain("$");
	});

	it("formats an RFC3339 datetime with a date pattern", () => {
		expect(
			parseText('{formatDatetime("2026-06-03T09:30:00.000Z", "MM/dd/yyyy")}'),
		).toBe("06/03/2026");
	});

	it("formats a local ISO datetime with a time pattern", () => {
		expect(parseText('{formatDatetime("2026-06-03T09:30:00", "HH:mm")}')).toBe(
			"09:30",
		);
	});

	it("formats datum context with row date and time patterns", () => {
		const context = { datum: "2026-06-03T09:30:00" };

		expect(parseText('{formatDatetime($datum, "EEE d")}', context)).toBe(
			"Wed 3",
		);
		expect(parseText('{formatDatetime($datum, "HH:mm")}', context)).toBe(
			"09:30",
		);
		expect(parseText('{formatDatetime($datum, "h:mm a")}', context)).toBe(
			"9:30 AM",
		);
		expect(parseText('{formatDatetime($datum, "do")}', context)).toBe("3rd");
		expect(parseText('{formatDatetime($datum, "EEE do")}', context)).toBe(
			"Wed 3rd",
		);
		expect(parseText('{formatDatetime($datum, "MMM")}', context)).toBe("Jun");
		expect(
			parseText('{formatDatetime("2026-11-03T09:30:00", "MMM")}', context),
		).toBe("Nov");
	});

	it("replaces property path with friendly label", () => {
		const out = parseText("Hello {item.title}");
		expect(out).not.toContain("{item.title}");
		expect(out.length).toBeGreaterThan(5);
	});

	it("strips comparison expressions in braces", () => {
		expect(parseText("x {a > 5} y")).toBe("x  y");
	});

	it("converts escaped newline sequences", () => {
		expect(parseText("a\\nb")).toBe("a\nb");
	});
});
