import { describe, expect, it } from "bun:test";
import { TEST_RESOURCE_ID } from "../../testFixtures/resourceCatalog";
import { shouldOfferCreateSubmitWithFlow } from "./createDraftSignals";

describe("createDraftSignals", () => {
	const itemResourceRef = TEST_RESOURCE_ID.RECORDS;
	const declared = itemResourceRef;

	it("offers submit create only for the declared target", () => {
		expect(shouldOfferCreateSubmitWithFlow(itemResourceRef, declared)).toBe(
			true,
		);
	});

	it("does not offer submit create without a declaration", () => {
		expect(shouldOfferCreateSubmitWithFlow(itemResourceRef, null)).toBe(
			false,
		);
	});

	it("does not offer submit create for a different resource", () => {
		expect(shouldOfferCreateSubmitWithFlow("evy.addresses", declared)).toBe(
			false,
		);
	});

	it("does not offer submit create for a different service prefix", () => {
		expect(
			shouldOfferCreateSubmitWithFlow("marketplace.items", declared),
		).toBe(false);
	});
});
