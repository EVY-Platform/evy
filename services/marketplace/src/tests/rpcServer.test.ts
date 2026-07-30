import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { ResourcesResponse } from "evy-types";
import { getFreePort } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { schema } from "../db";
import { MARKETPLACE_RESOURCE } from "../resources";
import {
	createPgliteTestDatabase,
	registerMarketplaceTestDb,
} from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

registerMarketplaceTestDb(testDb);

const { startMarketplaceRpcServer, stopMarketplaceRpcServer } = await import(
	"../rpc"
);

let ws_port: number;

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	ws_port = await getFreePort();
	await startMarketplaceRpcServer({ host: "127.0.0.1", port: ws_port });
});

afterAll(async () => {
	stopMarketplaceRpcServer();
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

function createClient(): InstanceType<typeof Client> {
	return new Client(`ws://127.0.0.1:${ws_port}`);
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

describe("marketplace JSON-RPC server", () => {
	it("Create and Get round-trip typed params", async () => {
		const client = createClient();
		await waitForOpen(client);
		const row = { id: crypto.randomUUID(), value: "rpc-condition" };

		await client.call("create", {
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});

		const got = await client.call("get", {
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});

		expect(got).toEqual([row]);
		client.close();
	});

	it("returns the marketplace resource manifest", async () => {
		const client = createClient();
		await waitForOpen(client);

		const response = (await client.call(
			"resources",
			{},
		)) as ResourcesResponse;
		const resources = response.services[0]?.resources ?? [];
		const items = resources.find(
			(entry) => entry.id === MARKETPLACE_RESOURCE.ITEMS,
		);
		const conditions = resources.find(
			(entry) => entry.id === MARKETPLACE_RESOURCE.CONDITIONS,
		);

		expect(items?.id).toBe(MARKETPLACE_RESOURCE.ITEMS);
		expect(conditions?.id).toBe(MARKETPLACE_RESOURCE.CONDITIONS);
		client.close();
	});

	// The builder reads attributes off the manifest rather than guessing them
	// from whatever rows happened to sync, so they have to survive the wire.
	it("declares bindable attributes for each resource", async () => {
		const client = createClient();
		await waitForOpen(client);

		const response = (await client.call(
			"resources",
			{},
		)) as ResourcesResponse;
		const resources = response.services[0]?.resources ?? [];
		const items = resources.find(
			(entry) => entry.id === MARKETPLACE_RESOURCE.ITEMS,
		);
		const conditions = resources.find(
			(entry) => entry.id === MARKETPLACE_RESOURCE.CONDITIONS,
		);

		expect(items?.attributes).toContain("price.currency");
		expect(items?.attributes).toContain(
			"transfer_options.pickup.address_id",
		);
		expect(conditions?.attributes).toEqual(["id", "value"]);
		client.close();
	});
});
