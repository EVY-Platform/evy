import { describe, expect, it } from "bun:test";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import { shouldOfferCreateSubmitWithFlow } from "./createDraftSignals";

describe("createDraftSignals", () => {
	const itemResourceId = MARKETPLACE_RESOURCE.ITEMS;

	it("offers submit create when destinations target the resource", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				MARKETPLACE_SERVICE,
				itemResourceId,
				[`${itemResourceId}.price`],
				new Set(),
			),
		).toBe(true);
	});

	it("offers submit create when a draft-mode update targets the resource", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				MARKETPLACE_SERVICE,
				itemResourceId,
				[],
				new Set([`${MARKETPLACE_SERVICE}/${itemResourceId}`]),
			),
		).toBe(true);
	});

	it("does not offer submit create without destination or draft-update signals", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				MARKETPLACE_SERVICE,
				itemResourceId,
				["pickup_address"],
				new Set(),
			),
		).toBe(false);
	});
});
