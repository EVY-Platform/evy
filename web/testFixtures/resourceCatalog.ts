import type { ResourcesResponse } from "evy-types";
import type { ServiceResource } from "../app/types/resources";

const TEST_RESOURCE_ID = {
	SELLING_REASONS: "22222222-2222-4222-8222-222222222222",
	CONDITIONS: "33333333-3333-4333-8333-333333333333",
	RECORDS: "44444444-4444-4444-8444-444444444444",
} as const;

const TEST_RESOURCE_CATALOG: ResourcesResponse = {
	services: [
		{
			id: "11111111-1111-4111-8111-111111111111",
			name: "test-service",
			resources: [
				{
					id: TEST_RESOURCE_ID.SELLING_REASONS,
					name: "selling_reasons",
					attributes: ["id", "value"],
				},
				{
					id: TEST_RESOURCE_ID.CONDITIONS,
					name: "conditions",
					attributes: ["id", "value"],
				},
				{
					id: TEST_RESOURCE_ID.RECORDS,
					name: "records",
					attributes: [
						"id",
						"price.currency",
						"price.value",
						"title",
					],
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

export { TEST_RESOURCE_ID };

export const TEST_SERVICE_NAMES: Record<string, string> = {
	[TEST_SERVICE_ID]: "Test Service",
};

export function testServiceResources(): ServiceResource[] {
	return testServiceDescriptor.resources.map((resource) => ({
		id: resource.id,
		serviceId: testServiceDescriptor.id,
		name: resource.name,
	}));
}
