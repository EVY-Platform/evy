import { describe, expect, test } from "bun:test";

import {
	formatResourceRef,
	isValidResourceRef,
	isValidServiceSlug,
	parseResourceRef,
	RESERVED_SERVICE_SLUGS,
	ResourceRefError,
	serviceOfRef,
} from "../types/resourceRef";

describe("resourceRef", () => {
	test("valid refs parse into service and resource segments", () => {
		expect(parseResourceRef("marketplace.items")).toEqual({
			service: "marketplace",
			resource: "items",
		});
		expect(parseResourceRef("evy.messages")).toEqual({
			service: "evy",
			resource: "messages",
		});
		expect(serviceOfRef("evy.flows")).toBe("evy");
	});

	test("formatResourceRef joins segments", () => {
		expect(formatResourceRef("marketplace", "items")).toBe(
			"marketplace.items",
		);
	});

	test("rejects bare resource slug without service prefix", () => {
		expect(() => parseResourceRef("items")).toThrow(ResourceRefError);
		expect(isValidResourceRef("items")).toBe(false);
	});

	test("rejects three-segment refs", () => {
		expect(() => parseResourceRef("a.b.c")).toThrow(ResourceRefError);
	});

	test("rejects reserved service slugs", () => {
		for (const slug of RESERVED_SERVICE_SLUGS) {
			expect(() => parseResourceRef(`${slug}.items`)).toThrow(
				ResourceRefError,
			);
			expect(isValidServiceSlug(slug)).toBe(false);
		}
	});

	test("rejects uppercase", () => {
		expect(isValidResourceRef("Marketplace.items")).toBe(false);
		expect(isValidServiceSlug("Evy")).toBe(false);
	});

	test("rejects dots in service slug", () => {
		expect(() => formatResourceRef("evy.core", "items")).toThrow(
			ResourceRefError,
		);
	});
});
