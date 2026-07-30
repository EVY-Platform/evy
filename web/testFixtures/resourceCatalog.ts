import type { ResourcesResponse } from "evy-types";
import type { ServiceResource } from "../app/types/resources";

const TEST_SERVICE_SLUG = "test_service";

const TEST_RESOURCE_ID = {
	SELLING_REASONS: "test_service.selling_reasons",
	CONDITIONS: "test_service.conditions",
	RECORDS: "test_service.records",
} as const;

const TEST_RESOURCE_CATALOG: ResourcesResponse = {
	services: [
		{
			id: TEST_SERVICE_SLUG,
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
