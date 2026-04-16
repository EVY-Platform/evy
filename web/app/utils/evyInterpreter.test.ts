import { describe, expect, it } from "bun:test";

import { parseText } from "./evyInterpreter";

describe("parseText", () => {
	it("returns empty string for empty input", () => {
		expect(parseText("")).toBe("");
	});

	it("resolves count function placeholder", () => {
		expect(parseText("Items: {count()}")).toContain("1");
	});

	it("resolves formatCurrency placeholder", () => {
		expect(parseText("{formatCurrency()}")).toContain("$");
	});

	it("replaces property path with friendly label", () => {
		const out = parseText("Hello {item.title}");
		expect(out).not.toContain("{item.title}");
		expect(out.length).toBeGreaterThan(5);
	});

	it("strips comparison expressions in braces", () => {
		expect(parseText("x {a > 5} y")).toBe("x  y");
	});

	it("passes through plain text", () => {
		expect(parseText("no placeholders")).toBe("no placeholders");
	});

	it("converts escaped newline sequences", () => {
		expect(parseText("a\\nb")).toBe("a\nb");
	});

	it("chains multiple replacements", () => {
		const out = parseText("{count()} and {length()}");
		expect(out).toMatch(/1/);
	});
});
