import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import {
	MARKETPLACE_RESOURCE,
	MARKETPLACE_SERVICE,
} from "../../../services/marketplace/src/resources";
import * as data from "../data/data";
import type { EvyDb } from "../database/db";
import { discoverResources } from "../procedures/resources";
import * as services from "../procedures/services";

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
				id: MARKETPLACE_SERVICE,
				name: "marketplace",
				description: "Marketplace",
				wsHost: null,
				wsPort: null,
				sortOrder: 1,
				createdAt: "",
				updatedAt: "",
			},
		]);
		forwardResourcesSpy = spyOn(
			services,
			"forwardResources",
		).mockResolvedValue({
			services: [
				{
					id: MARKETPLACE_SERVICE,
					name: "marketplace",
					resources: [
						{ id: MARKETPLACE_RESOURCE.ITEMS, name: "items" },
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
						{ id: EVY_CORE_RESOURCE.FLOWS, name: "flow" },
						{ id: EVY_CORE_RESOURCE.RESOURCES, name: "resource" },
					]),
				}),
				expect.objectContaining({
					id: MARKETPLACE_SERVICE,
					name: "marketplace",
					resources: [
						{ id: MARKETPLACE_RESOURCE.ITEMS, name: "items" },
					],
				}),
			]),
		);
		expect(result.errors).toBeUndefined();
	});

	it("returns attributed errors when an external service is unavailable", async () => {
		forwardResourcesSpy.mockRejectedValue(
			new Error("marketplace unavailable"),
		);

		const result = await discoverResources(db);

		expect(
			result.services.some((service) => service.id === EVY_CORE_SERVICE),
		).toBe(true);
		expect(result.errors).toEqual([
			{
				service: MARKETPLACE_SERVICE,
				message: "marketplace unavailable",
			},
		]);
	});
});
