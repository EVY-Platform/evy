import { describe, expect, test } from "bun:test";

import {
	formatResourceRef,
	isValidResourceRef,
	isValidServiceSlug,
	parseResourceRef,
	RESERVED_SERVICE_SLUGS,
	ResourceRefError,
	resourceOfRef,
	resourceRefRecord,
	serviceOfRef,
	splitRefFromPath,
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
		expect(resourceOfRef("evy.flows")).toBe("flows");
	});

	test("formatResourceRef joins segments", () => {
		expect(formatResourceRef("marketplace", "items")).toBe(
			"marketplace.items",
		);
	});

	test("splitRefFromPath extracts a leading ref", () => {
		expect(splitRefFromPath("marketplace.items.price")).toEqual({
			ref: "marketplace.items",
			rest: "price",
		});
		expect(splitRefFromPath("items")).toBeNull();
	});

	test("resourceRefRecord builds keyed refs", () => {
		expect(
			resourceRefRecord("test_service", {
				ITEMS: "items",
				ORDERS: "orders",
			}),
		).toEqual({
			ITEMS: "test_service.items",
			ORDERS: "test_service.orders",
		});
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

	test("rejects invalid service slug in formatResourceRef", () => {
		expect(() => formatResourceRef("evy.core", "items")).toThrow(
			ResourceRefError,
		);
	});
});
