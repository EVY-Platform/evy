import { describe, expect, it } from "bun:test";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "evy-types/marketplaceResources";
import {
	destinationDraftsTargetResource,
	flowHasDraftUpdateForResource,
	shouldOfferCreateSubmitWithFlow,
} from "./createDraftSignals";

describe("createDraftSignals", () => {
	const itemResourceId = MARKETPLACE_RESOURCE.ITEMS;

	it("detects destinations scoped to a resource id", () => {
		expect(
			destinationDraftsTargetResource(
				[`${itemResourceId}.title`, "pickup_address"],
				itemResourceId,
			),
		).toBe(true);
		expect(
			destinationDraftsTargetResource(["pickup_address"], itemResourceId),
		).toBe(false);
	});

	it("detects draft-mode update actions for a service and resource", () => {
		const branches = [
			`{update(${MARKETPLACE_SERVICE},${itemResourceId},{},{title: x},draft)}`,
		];
		expect(
			flowHasDraftUpdateForResource(
				branches,
				MARKETPLACE_SERVICE,
				itemResourceId,
			),
		).toBe(true);
		expect(
			flowHasDraftUpdateForResource(
				["{close()}"],
				MARKETPLACE_SERVICE,
				itemResourceId,
			),
		).toBe(false);
	});

	it("offers submit create when destinations target the resource", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				MARKETPLACE_SERVICE,
				itemResourceId,
				[`${itemResourceId}.price`],
				[],
			),
		).toBe(true);
	});

	it("does not offer submit create without destination or draft-update signals", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				MARKETPLACE_SERVICE,
				itemResourceId,
				["pickup_address"],
				[],
			),
		).toBe(false);
	});
});
