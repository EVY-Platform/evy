import { describe, expect, it } from "bun:test";
import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import { parseText } from "./interpreter";

const compoundDimensionsText =
	"{formatDimension(item.width) (w) x formatDimension(item.height) (h) x formatDimension(item.length) (l)}";

describe("parseText", () => {
	it("resolves count function placeholder", () => {
		expect(parseText("Items: {count()}")).toContain("1");
	});

	it("resolves formatCurrency placeholder", () => {
		expect(parseText("{formatCurrency()}")).toContain("$");
	});

	it("formats an RFC3339 datetime with a date pattern", () => {
		expect(
			parseText(
				'{formatDatetime("2026-06-03T09:30:00.000Z", "MM/dd/yyyy")}',
			),
		).toBe("06/03/2026");
	});

	it("formats a local ISO datetime with a time pattern", () => {
		expect(
			parseText('{formatDatetime("2026-06-03T09:30:00", "HH:mm")}'),
		).toBe("09:30");
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
		expect(parseText('{formatDatetime($datum, "do")}', context)).toBe(
			"3rd",
		);
		expect(parseText('{formatDatetime($datum, "EEE do")}', context)).toBe(
			"Wed 3rd",
		);
		expect(parseText('{formatDatetime($datum, "MMM")}', context)).toBe(
			"Jun",
		);
		expect(
			parseText(
				'{formatDatetime("2026-11-03T09:30:00", "MMM")}',
				context,
			),
		).toBe("Nov");
	});

	it("formats literal dimensions", () => {
		expect(parseText("{formatDimension(100)}")).toBe("100mm");
		expect(parseText("{formatDimension(101)}")).toBe("10cm");
		expect(parseText("{formatDimension(1000)}")).toBe("100cm");
		expect(parseText("{formatDimension(1001)}")).toBe("1m");
		expect(parseText("{formatDimension(23240)}")).toBe("23m");
	});

	it("formats dimensions from preview mock data", () => {
		expect(parseText("{formatDimension(item.width)}")).toBe("23m");
		expect(parseText("{formatDimension(item.dimensions.width)}")).toBe(
			"23m",
		);
		expect(parseText("{formatDimension(width)}")).toBe("23m");
	});

	it("formats compound dimension functions inside one braced expression", () => {
		expect(parseText(compoundDimensionsText)).toBe(
			"23m (w) x 23m (h) x 23m (l)",
		);
	});

	it("formats bracketed mock data paths", () => {
		expect(parseText("{formatDimension(items[0].width)}")).toBe("23m");
	});

	it("formats dimensions from datum context", () => {
		expect(parseText("{formatDimension($datum)}", { datum: "1200" })).toBe(
			"1m",
		);
	});

	it("resolves findFirst to the data argument for mock data", () => {
		expect(
			parseText(
				`{findFirst(${MARKETPLACE_RESOURCE.SELLING_REASONS}, item.selling_reason_id)}`,
			),
		).toBe(MARKETPLACE_RESOURCE.SELLING_REASONS);
	});

	it("keeps text after findFirst as a normal suffix", () => {
		expect(
			parseText(
				`{findFirst(${MARKETPLACE_RESOURCE.SELLING_REASONS}, item.selling_reason_id)}.value`,
			),
		).toBe(`${MARKETPLACE_RESOURCE.SELLING_REASONS}.value`);
	});

	it("keeps dimension preview safe for unresolved values", () => {
		expect(parseText("{formatDimension(item.unknown)}")).toBe("100mm");
	});

	it("replaces property path with its raw prop path", () => {
		expect(parseText("Hello {item.title}")).toBe("Hello item.title");
	});

	it("displays resource ID-prefixed paths with mapped entity names", () => {
		const resourceMap = new Map([[MARKETPLACE_RESOURCE.ITEMS, "item"]]);
		const otherMap = new Map([[MARKETPLACE_RESOURCE.ITEMS, "listing"]]);

		expect(
			parseText(
				`Hello {${MARKETPLACE_RESOURCE.ITEMS}.title}`,
				undefined,
				resourceMap,
			),
		).toBe("Hello item.title");

		// Different map, different result — no global state leakage
		expect(
			parseText(
				`Hello {${MARKETPLACE_RESOURCE.ITEMS}.title}`,
				undefined,
				otherMap,
			),
		).toBe("Hello listing.title");
	});

	it("strips comparison expressions in braces", () => {
		expect(parseText("x {a > 5} y")).toBe("x  y");
	});

	it("converts escaped newline sequences", () => {
		expect(parseText("a\\nb")).toBe("a\nb");
	});
});
