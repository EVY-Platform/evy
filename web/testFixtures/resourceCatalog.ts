import type { ResourcesResponse } from "evy-types";
import { formatResourceRef } from "evy-types/resourceRef";
import type { ServiceResource } from "../app/types/resources";

export const TEST_SERVICE_SLUG = "test_service";

const TEST_RESOURCE_NAMES = {
	SELLING_REASONS: "selling_reasons",
	CONDITIONS: "conditions",
	RECORDS: "records",
} as const;

const TEST_RESOURCE_ID = Object.fromEntries(
	Object.entries(TEST_RESOURCE_NAMES).map(([key, name]) => [
		key,
		formatResourceRef(TEST_SERVICE_SLUG, name),
	]),
) as {
	readonly SELLING_REASONS: string;
	readonly CONDITIONS: string;
	readonly RECORDS: string;
};

const TEST_RESOURCE_CATALOG: ResourcesResponse = {
	services: [
		{
			id: TEST_SERVICE_SLUG,
			name: "test-service",
			resources: [
				{
					id: TEST_RESOURCE_ID.SELLING_REASONS,
					name: TEST_RESOURCE_NAMES.SELLING_REASONS,
					attributes: ["id", "value"],
				},
				{
					id: TEST_RESOURCE_ID.CONDITIONS,
					name: TEST_RESOURCE_NAMES.CONDITIONS,
					attributes: ["id", "value"],
				},
				{
					id: TEST_RESOURCE_ID.RECORDS,
					name: TEST_RESOURCE_NAMES.RECORDS,
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

export const TEST_SERVICE_ID = TEST_SERVICE_SLUG;

export { TEST_RESOURCE_ID };

export const TEST_SERVICE_NAMES: Record<string, string> = {
	[TEST_SERVICE_ID]: "Test Service",
};

export function testServiceResources(): ServiceResource[] {
	return testServiceDescriptor.resources.map((resource) => ({
		id: resource.id,
		name: resource.name,
	}));
}
