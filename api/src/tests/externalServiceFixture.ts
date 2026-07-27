import type { ResourcesResponse } from "evy-types";
import type { ServiceDescriptor } from "evy-types/serviceManifest";

export const EXTERNAL_TEST_SERVICE_ID =
	"a1111111-1111-4111-8111-111111111111" as const;

export const EXTERNAL_TEST_SERVICE_NAME = "test-service" as const;

export const EXTERNAL_TEST_RESOURCE = {
	SELLING_REASONS: "b2222222-2222-4222-8222-222222222222",
	CONDITIONS: "c3333333-3333-4333-8333-333333333333",
	DURATIONS: "d4444444-4444-4444-8444-444444444444",
	AREAS: "e5555555-5555-4555-8555-555555555555",
	RECORDS: "f6666666-6666-4666-8666-666666666666",
} as const;

export const EXTERNAL_TEST_SERVICE_DESCRIPTOR: ServiceDescriptor = {
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

export const EXTERNAL_TEST_RESOURCES_RESPONSE: ResourcesResponse = {
	services: [EXTERNAL_TEST_SERVICE_DESCRIPTOR],
};
