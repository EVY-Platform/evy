import { describe, expect, it } from "bun:test";
import {
	TEST_RESOURCE_ID,
	TEST_SERVICE_ID,
} from "../../testFixtures/resourceCatalog";
import { shouldOfferCreateSubmitWithFlow } from "./createDraftSignals";

describe("createDraftSignals", () => {
	const itemResourceId = TEST_RESOURCE_ID.RECORDS;
	const declared = `${TEST_SERVICE_ID}/${itemResourceId}`;

	it("offers submit create only for the declared target", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				TEST_SERVICE_ID,
				itemResourceId,
				declared,
			),
		).toBe(true);
	});

	it("does not offer submit create without a declaration", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				TEST_SERVICE_ID,
				itemResourceId,
				null,
			),
		).toBe(false);
	});

	it("does not offer submit create for a different resource", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				TEST_SERVICE_ID,
				"addresses",
				declared,
			),
		).toBe(false);
	});

	it("does not offer submit create for a different service", () => {
		expect(
			shouldOfferCreateSubmitWithFlow(
				"475731ac-31aa-4d65-94d2-7032782ae359",
				itemResourceId,
				declared,
			),
		).toBe(false);
	});
});
