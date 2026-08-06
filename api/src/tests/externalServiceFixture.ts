import type { ResourcesResponse } from "evy-types";
import { formatResourceRef, resourceRefRecord } from "evy-types/resourceRef";

export const EXTERNAL_TEST_SERVICE_ID = "test_svc" as const;

const EXTERNAL_TEST_SERVICE_NAME = "test-service" as const;

const EXTERNAL_TEST_RESOURCE_NAMES = {
	SELLING_REASONS: "selling_reasons",
	CONDITIONS: "conditions",
	DURATIONS: "durations",
	AREAS: "areas",
	RECORDS: "records",
} as const;

export const EXTERNAL_TEST_RESOURCE = resourceRefRecord(
	EXTERNAL_TEST_SERVICE_ID,
	EXTERNAL_TEST_RESOURCE_NAMES,
);

export const EXTERNAL_TEST_SERVICE_DESCRIPTOR: ResourcesResponse["services"][number] =
	{
		id: EXTERNAL_TEST_SERVICE_ID,
		name: EXTERNAL_TEST_SERVICE_NAME,
		resources: Object.entries(EXTERNAL_TEST_RESOURCE_NAMES).map(
			([, name]) => ({
				id: formatResourceRef(EXTERNAL_TEST_SERVICE_ID, name),
				name,
				visibility: "public" as const,
			}),
		),
	};
