import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getFreePort } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { schema } from "../db";
import {
	createPgliteTestDatabase,
	registerMarketplaceTestDb,
} from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

registerMarketplaceTestDb(testDb);

const { startMarketplaceRpcServer, stopMarketplaceRpcServer } = await import(
	"../rpc"
);

let wsPort: number;

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	wsPort = await getFreePort();
	await startMarketplaceRpcServer({ host: "127.0.0.1", port: wsPort });
});

afterAll(async () => {
	stopMarketplaceRpcServer();
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

function createClient(): InstanceType<typeof Client> {
	return new Client(`ws://127.0.0.1:${wsPort}`);
}

async function waitForOpen(client: InstanceType<typeof Client>): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const onOpen = () => {
			client.removeListener("error", onError);
			resolve();
		};
		const onError = (err: Error) => {
			client.removeListener("open", onOpen);
			reject(err);
		};
		client.on("open", onOpen);
		client.on("error", onError);
	});
}

type DiscoveredMarketplaceIds = {
	serviceId: string;
	conditionsResourceId: string;
	itemsResourceId: string;
};

async function discoverMarketplaceIds(
	client: InstanceType<typeof Client>,
): Promise<DiscoveredMarketplaceIds> {
	const response = await client.call("resources", {});
	if (
		typeof response !== "object" ||
		response === null ||
		!("services" in response) ||
		!Array.isArray(response.services)
	) {
		throw new Error("Expected resources response with services array");
	}

	const marketplaceService = response.services.find(
		(service: { name?: string }) => service.name === "marketplace",
	);
	if (!marketplaceService || typeof marketplaceService.id !== "string") {
		throw new Error("Expected marketplace service in resources response");
	}

	const resources = Array.isArray(marketplaceService.resources)
		? marketplaceService.resources
		: [];
	const conditionsResource = resources.find(
		(resource: { name?: string }) => resource.name === "conditions",
	);
	const itemsResource = resources.find(
		(resource: { name?: string }) => resource.name === "items",
	);
	if (
		!conditionsResource ||
		typeof conditionsResource.id !== "string" ||
		!itemsResource ||
		typeof itemsResource.id !== "string"
	) {
		throw new Error(
			"Expected conditions and items resources in marketplace manifest",
		);
	}

	return {
		serviceId: marketplaceService.id,
		conditionsResourceId: conditionsResource.id,
		itemsResourceId: itemsResource.id,
	};
}

describe("marketplace JSON-RPC server", () => {
	it("Create and Get round-trip typed params", async () => {
		const client = createClient();
		await waitForOpen(client);
		const discovered = await discoverMarketplaceIds(client);
		const row = { id: crypto.randomUUID(), value: "rpc-condition" };

		await client.call("create", {
			service: discovered.serviceId,
			resource: discovered.conditionsResourceId,
			data: row,
		});

		const got = await client.call("get", {
			service: discovered.serviceId,
			resource: discovered.conditionsResourceId,
		});

		expect(got).toEqual([row]);
		client.close();
	});

	it("returns the marketplace resource manifest", async () => {
		const client = createClient();
		await waitForOpen(client);

		const response = await client.call("resources", {});

		expect(response).toEqual({
			services: [
				expect.objectContaining({
					name: "marketplace",
					resources: expect.arrayContaining([
						expect.objectContaining({ name: "items" }),
						expect.objectContaining({ name: "conditions" }),
					]),
				}),
			],
		});
		client.close();
	});
});
