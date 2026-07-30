import { describe, expect, it } from "bun:test";
import {
	validateDataMarketplaceItem,
	validateDataMarketplaceLookup,
} from "../validation";

const fixtureItem = {
	id: "12401f50-cf1a-45d7-a112-2e68a2070466",
	title: "Amazing Fridge",
	photo_ids: ["cfa7e4aa-928d-4920-a370-57ed713b2917"],
	price: { currency: "AUD", value: 250 },
	seller_id: "04b34671-4eeb-4f1c-8435-5e029a0e455c",
	created_at: "2026-05-20T22:56:17.000Z",
	dimensions: { width: 500, height: 1600, length: 600, weight: 10 },
	payment_methods: { cash: true, app: true },
	transfer_options: {
		pickup: {
			selection: ["2026-06-03T09:00:00"],
			lead_time_hours: "24",
			address_id: "c81e85dd-f7fb-4310-8fc6-7c018aeaf82a",
		},
		delivery: { selection: [], fee: {} },
		ship: { postal_code: "", areas: [] },
	},
};

describe("validateDataMarketplaceItem", () => {
	it("accepts a seeded-shape item", () => {
		expect(validateDataMarketplaceItem(fixtureItem)).toEqual(fixtureItem);
	});

	// The create flow merges flat draft fields into a new item, so an item is
	// shaped differently depending on how it was made.
	it("accepts the flat draft fields the create flow writes", () => {
		expect(() =>
			validateDataMarketplaceItem({
				...fixtureItem,
				payment_cash: "true",
				payment_app: "false",
				delivery_fee: "1",
				shipping_fee: "12.50",
				distance: ["3e0f4b97-97c3-46da-a242-a5c1e8e63245"],
			}),
		).not.toThrow();
	});

	it("accepts unknown top-level fields", () => {
		expect(() =>
			validateDataMarketplaceItem({
				...fixtureItem,
				some_future_field: "whatever",
			}),
		).not.toThrow();
	});

	it("rejects a non-uuid id", () => {
		expect(() =>
			validateDataMarketplaceItem({ ...fixtureItem, id: "not-a-uuid" }),
		).toThrow('/id: must match format "uuid"');
	});

	it("rejects an item with no id", () => {
		const { id: _omitted, ...withoutId } = fixtureItem;
		expect(() => validateDataMarketplaceItem(withoutId)).toThrow(
			"must have required property 'id'",
		);
	});

	it("rejects a misspelled key inside a typed sub-object", () => {
		expect(() =>
			validateDataMarketplaceItem({
				...fixtureItem,
				transfer_options: { pickupp: {} },
			}),
		).toThrow("/transfer_options: must NOT have additional propert");
	});

	it("rejects a price that is not an object", () => {
		expect(() =>
			validateDataMarketplaceItem({ ...fixtureItem, price: 250 }),
		).toThrow("/price: must be object");
	});

	it("rejects a draft flag written as a boolean", () => {
		expect(() =>
			validateDataMarketplaceItem({
				...fixtureItem,
				payment_cash: true,
			}),
		).toThrow();
	});

	it("labels failures as MarketplaceItem", () => {
		expect(() =>
			validateDataMarketplaceItem({ ...fixtureItem, price: 250 }),
		).toThrow("MarketplaceItem validation failed");
	});
});

describe("validateDataMarketplaceLookup", () => {
	const fixtureLookup = {
		id: "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
		value: "For parts",
	};

	it("accepts a label row", () => {
		expect(validateDataMarketplaceLookup(fixtureLookup)).toEqual(
			fixtureLookup,
		);
	});

	it("rejects a non-uuid id", () => {
		expect(() =>
			validateDataMarketplaceLookup({ ...fixtureLookup, id: "nope" }),
		).toThrow('/id: must match format "uuid"');
	});

	it("rejects a non-string value", () => {
		expect(() =>
			validateDataMarketplaceLookup({ ...fixtureLookup, value: 12 }),
		).toThrow("/value: must be string");
	});

	it("requires a value", () => {
		expect(() =>
			validateDataMarketplaceLookup({ id: fixtureLookup.id }),
		).toThrow("must have required property 'value'");
	});

	// Nothing merges draft fields into a lookup row, so an unexpected key means
	// the wrong resource was written.
	it("rejects unknown keys", () => {
		expect(() =>
			validateDataMarketplaceLookup({ ...fixtureLookup, extra: true }),
		).toThrow("must NOT have additional propert");
	});

	it("labels failures as MarketplaceLookup", () => {
		expect(() => validateDataMarketplaceLookup({})).toThrow(
			"MarketplaceLookup validation failed",
		);
	});
});
