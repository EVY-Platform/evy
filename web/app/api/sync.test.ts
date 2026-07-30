import { describe, expect, it } from "bun:test";
import type { ResourcesResponse, SyncResponse } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { extractResourceAttributeMetadata } from "./sync";

const SERVICE_ID = "test_service";
const DECLARED_RESOURCE = "test_service.records";
const UNDECLARED_RESOURCE = "test_service.legacy";

function catalogWith(
	resources: ResourcesResponse["services"][number]["resources"],
): ResourcesResponse {
	return {
		services: [{ id: SERVICE_ID, name: "test-service", resources }],
	};
}

function syncWith(data: SyncResponse["data"]): SyncResponse {
	return { cursor: "2026-01-01T00:00:00.000Z", data } as SyncResponse;
}

describe("extractResourceAttributeMetadata", () => {
	it("uses the attributes the service declared", () => {
		const catalog = catalogWith([
			{
				id: DECLARED_RESOURCE,
				name: "records",
				attributes: ["id", "price.currency", "title"],
			},
		]);

		expect(extractResourceAttributeMetadata(catalog, syncWith([]))).toEqual(
			[
				{
					serviceId: SERVICE_ID,
					resourceId: DECLARED_RESOURCE,
					attributeNames: ["id", "price.currency", "title"],
				},
			],
		);
	});

	it("offers declared attributes for a resource with no rows yet", () => {
		const catalog = catalogWith([
			{
				id: DECLARED_RESOURCE,
				name: "records",
				attributes: ["id", "title"],
			},
		]);

		const result = extractResourceAttributeMetadata(catalog, syncWith([]));

		expect(result[0]?.attributeNames).toEqual(["id", "title"]);
	});

	it("prefers declared attributes over what the rows happen to show", () => {
		const catalog = catalogWith([
			{
				id: DECLARED_RESOURCE,
				name: "records",
				attributes: ["id", "title", "unused_but_valid"],
			},
		]);
		const sync = syncWith([
			{
				resource: DECLARED_RESOURCE,
				value: [{ id: "a", title: "t" }],
			},
		]);

		expect(
			extractResourceAttributeMetadata(catalog, sync)[0]?.attributeNames,
		).toEqual(["id", "title", "unused_but_valid"]);
	});

	it("falls back to inferring from rows when the service declares nothing", () => {
		const catalog = catalogWith([
			{ id: UNDECLARED_RESOURCE, name: "legacy" },
		]);
		const sync = syncWith([
			{
				resource: UNDECLARED_RESOURCE,
				value: [{ id: "a", nested: { deep: 1 } }],
			},
		]);

		expect(
			extractResourceAttributeMetadata(catalog, sync)[0]?.attributeNames,
		).toEqual(["id", "nested", "nested.deep"]);
	});

	it("mixes declared and inferred resources in one catalog", () => {
		const catalog = catalogWith([
			{
				id: DECLARED_RESOURCE,
				name: "records",
				attributes: ["id", "title"],
			},
			{ id: UNDECLARED_RESOURCE, name: "legacy" },
		]);
		const sync = syncWith([
			{
				resource: UNDECLARED_RESOURCE,
				value: [{ id: "a", other: true }],
			},
		]);

		const result = extractResourceAttributeMetadata(catalog, sync);

		expect(result).toEqual([
			{
				serviceId: SERVICE_ID,
				resourceId: DECLARED_RESOURCE,
				attributeNames: ["id", "title"],
			},
			{
				serviceId: SERVICE_ID,
				resourceId: UNDECLARED_RESOURCE,
				attributeNames: ["id", "other"],
			},
		]);
	});

	it("omits resources with neither declared nor inferable attributes", () => {
		const catalog = catalogWith([
			{ id: UNDECLARED_RESOURCE, name: "legacy" },
		]);

		expect(extractResourceAttributeMetadata(catalog, syncWith([]))).toEqual(
			[],
		);
	});

	it("ignores core resources", () => {
		const catalog: ResourcesResponse = {
			services: [
				{
					id: EVY_CORE_SERVICE,
					name: "evy",
					resources: [
						{
							id: EVY_CORE_RESOURCE_REF.FLOWS,
							name: "flow",
							attributes: ["id", "name"],
						},
					],
				},
			],
		};

		expect(extractResourceAttributeMetadata(catalog, syncWith([]))).toEqual(
			[],
		);
	});
});
