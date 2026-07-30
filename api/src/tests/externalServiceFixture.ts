import type { ResourcesResponse } from "evy-types";

export const EXTERNAL_TEST_SERVICE_ID = "test_svc" as const;

const EXTERNAL_TEST_SERVICE_NAME = "test-service" as const;

export const EXTERNAL_TEST_RESOURCE = {
	SELLING_REASONS: "test_svc.selling_reasons",
	CONDITIONS: "test_svc.conditions",
	DURATIONS: "test_svc.durations",
	AREAS: "test_svc.areas",
	RECORDS: "test_svc.records",
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
