import { describe, expect, it } from "bun:test";

import { parseText } from "./interpreter";

describe("parseText", () => {
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

	it("converts escaped newline sequences", () => {
		expect(parseText("a\\nb")).toBe("a\nb");
	});
});
