import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import { discoverResources } from "../procedures/resources";
import * as services from "../procedures/services";
import {
	EXTERNAL_TEST_RESOURCE,
	EXTERNAL_TEST_SERVICE_DESCRIPTOR,
	EXTERNAL_TEST_SERVICE_ID,
} from "./externalServiceFixture";

const db = {
	select: () => ({
		from: () => ({
			where: () => ({
				limit: async () => [{ name: "evy" }],
			}),
		}),
	}),
} as unknown as EvyDb;

describe("resources", () => {
	let listExternalServicesSpy: ReturnType<typeof spyOn>;
	let forwardResourcesSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		listExternalServicesSpy = spyOn(
			data,
			"listExternalServices",
		).mockResolvedValue([
			{
				id: EXTERNAL_TEST_SERVICE_ID,
				name: EXTERNAL_TEST_SERVICE_DESCRIPTOR.name,
				description: "Marketplace",
				ws_host: null,
				ws_port: null,
				sort_order: 1,
				created_at: "",
				updated_at: "",
			},
		]);
		forwardResourcesSpy = spyOn(
			services,
			"forwardResources",
		).mockResolvedValue({
			services: [
				{
					...EXTERNAL_TEST_SERVICE_DESCRIPTOR,
					resources: [
						{
							id: EXTERNAL_TEST_RESOURCE.RECORDS,
							name: "records",
							visibility: "public",
						},
					],
				},
			],
		});
	});

	afterEach(() => {
		listExternalServicesSpy.mockRestore();
		forwardResourcesSpy.mockRestore();
	});

	it("aggregates the core manifest with external service manifests", async () => {
		const result = await discoverResources(db);

		expect(result.services).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: EVY_CORE_SERVICE,
					name: "evy",
					resources: expect.arrayContaining([
						{
							id: EVY_CORE_RESOURCE_REF.FLOWS,
							name: "flow",
							visibility: "public",
						},
						{
							id: EVY_CORE_RESOURCE_REF.RESOURCES,
							name: "resource",
							visibility: "public",
						},
					]),
				}),
				expect.objectContaining({
					...EXTERNAL_TEST_SERVICE_DESCRIPTOR,
					resources: [
						{
							id: EXTERNAL_TEST_RESOURCE.RECORDS,
							name: "records",
							visibility: "public",
						},
					],
				}),
			]),
		);
		expect(result.errors).toBeUndefined();
	});

	// Attribute lists are the owning service's business; the core api is a
	// courier for them, not an author or an editor.
	it("passes a service's declared attributes through untouched", async () => {
		const attributes = ["id", "price.currency", "title"];
		forwardResourcesSpy.mockResolvedValue({
			services: [
				{
					...EXTERNAL_TEST_SERVICE_DESCRIPTOR,
					resources: [
						{
							id: EXTERNAL_TEST_RESOURCE.RECORDS,
							name: "records",
							visibility: "public",
							attributes,
						},
					],
				},
			],
		});

		const result = await discoverResources(db);

		const external = result.services.find(
			(service) => service.id === EXTERNAL_TEST_SERVICE_ID,
		);
		expect(external?.resources[0]?.attributes).toEqual(attributes);
	});

	it("returns attributed errors when an external service is unavailable", async () => {
		forwardResourcesSpy.mockRejectedValue(
			new Error("test-service unavailable"),
		);

		const result = await discoverResources(db);

		expect(
			result.services.some((service) => service.id === EVY_CORE_SERVICE),
		).toBe(true);
		expect(result.errors).toEqual([
			{
				service: EXTERNAL_TEST_SERVICE_ID,
				message: "test-service unavailable",
			},
		]);
	});
});
