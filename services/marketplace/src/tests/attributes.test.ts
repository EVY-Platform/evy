import { describe, expect, it } from "bun:test";
import { attributesFromSchema } from "../attributes";
import itemSchema from "../schema/item.schema.json" with { type: "json" };

describe("attributesFromSchema", () => {
	const itemAttributes = attributesFromSchema(itemSchema);

	it("lists top-level properties", () => {
		expect(itemAttributes).toContain("id");
		expect(itemAttributes).toContain("title");
		expect(itemAttributes).toContain("seller_id");
	});

	it("includes the flat draft fields the create flow writes", () => {
		expect(itemAttributes).toContain("payment_cash");
		expect(itemAttributes).toContain("delivery_fee");
		expect(itemAttributes).toContain("shipping_destination_areas");
	});

	it("resolves $defs refs into dotted paths", () => {
		expect(itemAttributes).toContain("price");
		expect(itemAttributes).toContain("price.currency");
		expect(itemAttributes).toContain("price.value");
	});

	it("recurses into inline nested objects", () => {
		expect(itemAttributes).toContain("dimensions.width");
		expect(itemAttributes).toContain("payment_methods.cash");
		expect(itemAttributes).toContain("transfer_options.pickup.address_id");
		expect(itemAttributes).toContain("transfer_options.delivery.fee.value");
	});

	it("treats arrays as leaves", () => {
		expect(itemAttributes).toContain("photo_ids");
		expect(
			itemAttributes.some((name) => name.startsWith("photo_ids.")),
		).toBe(false);
		// An array of objects stops at the array; rows are addressed by index
		// at runtime, not by a static attribute path.
		expect(
			itemAttributes.some((name) =>
				name.startsWith("transfer_options.ship.areas."),
			),
		).toBe(false);
	});

	it("does not leak $defs names as attributes", () => {
		expect(itemAttributes).not.toContain("Price");
		expect(itemAttributes).not.toContain("$defs");
		expect(itemAttributes.some((name) => name.includes("$"))).toBe(false);
	});

	it("returns a sorted, deduped list", () => {
		expect(itemAttributes).toEqual(
			[...new Set(itemAttributes)].toSorted((a, b) => a.localeCompare(b)),
		);
	});

	it("handles a schema with no properties", () => {
		expect(attributesFromSchema({ type: "object" })).toEqual([]);
	});

	it("stops at the depth cap instead of recursing forever", () => {
		const recursive = {
			type: "object",
			properties: { child: { $ref: "#/$defs/Node" } },
			$defs: {
				Node: {
					type: "object",
					properties: {
						name: { type: "string" },
						child: { $ref: "#/$defs/Node" },
					},
				},
			},
		};
		const names = attributesFromSchema(recursive);
		expect(names).toContain("child.name");
		expect(names.length).toBeGreaterThan(0);
		const deepest = Math.max(
			...names.map((name) => name.split(".").length),
		);
		expect(deepest).toBeLessThanOrEqual(5);
	});
});
