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

	describe("with a declared submits target", () => {
		const declared = `${MARKETPLACE_SERVICE}/${itemResourceId}`;

		it("offers submit create for the declared target", () => {
			expect(
				shouldOfferCreateSubmitWithFlow(
					MARKETPLACE_SERVICE,
					itemResourceId,
					[],
					new Set(),
					declared,
				),
			).toBe(true);
		});

		// The declaration decides outright, so a create for some other entity
		// stays inline even though the flow drafts that entity elsewhere.
		it("does not offer submit create for a different resource", () => {
			expect(
				shouldOfferCreateSubmitWithFlow(
					MARKETPLACE_SERVICE,
					"addresses",
					["addresses.street"],
					new Set([`${MARKETPLACE_SERVICE}/addresses`]),
					declared,
				),
			).toBe(false);
		});

		it("does not offer submit create for a different service", () => {
			expect(
				shouldOfferCreateSubmitWithFlow(
					"475731ac-31aa-4d65-94d2-7032782ae359",
					itemResourceId,
					[],
					new Set(),
					declared,
				),
			).toBe(false);
		});

		it("ignores inferred signals that disagree with the declaration", () => {
			expect(
				shouldOfferCreateSubmitWithFlow(
					MARKETPLACE_SERVICE,
					itemResourceId,
					["pickup_address"],
					new Set(),
					declared,
				),
			).toBe(true);
		});
	});
});
