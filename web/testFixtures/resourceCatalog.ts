import type { ResourcesResponse } from "evy-types";
import { flattenServiceResources } from "evy-types/serviceManifest";
import type { ServiceResource } from "../app/types/resources";

export const TEST_RESOURCE_CATALOG: ResourcesResponse = {
	services: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			name: "test-service",
			resources: [
				{
					id: "22222222-2222-4222-8222-222222222222",
					name: "selling_reasons",
				},
				{
					id: "33333333-3333-4333-8333-333333333333",
					name: "conditions",
				},
				{
					id: "44444444-4444-4444-8444-444444444444",
					name: "records",
				},
			],
		},
	],
};

const testServiceDescriptor = TEST_RESOURCE_CATALOG.services[0];

if (!testServiceDescriptor) {
	throw new Error("TEST_RESOURCE_CATALOG must include a service descriptor");
}

export const TEST_SERVICE_ID = testServiceDescriptor.id;

export const TEST_SERVICE_NAME = testServiceDescriptor.name;

export const TEST_RESOURCE_ID = {
	SELLING_REASONS: "22222222-2222-4222-8222-222222222222",
	CONDITIONS: "33333333-3333-4333-8333-333333333333",
	RECORDS: "44444444-4444-4444-8444-444444444444",
} as const;

export const TEST_SERVICE_RESOURCES: ServiceResource[] =
	flattenServiceResources(TEST_RESOURCE_CATALOG);

export const TEST_SERVICE_NAMES: Record<string, string> = {
	[TEST_SERVICE_ID]: "Test Service",
};
