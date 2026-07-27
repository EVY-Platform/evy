import type { ResourcesResponse } from "evy-types";

export const EXTERNAL_TEST_SERVICE_ID =
	"a1111111-1111-4111-8111-111111111111" as const;

const EXTERNAL_TEST_SERVICE_NAME = "test-service" as const;

export const EXTERNAL_TEST_RESOURCE = {
	SELLING_REASONS: "b2222222-b222-4222-8222-222222222222",
	CONDITIONS: "c3333333-c333-4333-8333-333333333333",
	DURATIONS: "d4444444-d444-4444-8444-444444444444",
	AREAS: "e5555555-e555-4555-8555-555555555555",
	RECORDS: "f6666666-f666-4666-8666-666666666666",
} as const;

export const EXTERNAL_TEST_SERVICE_DESCRIPTOR: ResourcesResponse["services"][number] =
	{
		id: EXTERNAL_TEST_SERVICE_ID,
		name: EXTERNAL_TEST_SERVICE_NAME,
		resources: [
			{
				id: EXTERNAL_TEST_RESOURCE.SELLING_REASONS,
				name: "selling_reasons",
			},
			{ id: EXTERNAL_TEST_RESOURCE.CONDITIONS, name: "conditions" },
			{ id: EXTERNAL_TEST_RESOURCE.DURATIONS, name: "durations" },
			{ id: EXTERNAL_TEST_RESOURCE.AREAS, name: "areas" },
			{ id: EXTERNAL_TEST_RESOURCE.RECORDS, name: "records" },
		],
	};
