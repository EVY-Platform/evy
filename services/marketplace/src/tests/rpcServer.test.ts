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
import { discoverMarketplaceIds } from "./discoverMarketplaceIds";

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

describe("marketplace JSON-RPC server", () => {
	it("Create and Get round-trip typed params", async () => {
		const client = createClient();
		await waitForOpen(client);
		const response = await client.call("resources", {});
		const discovered = discoverMarketplaceIds(response, ["conditions"]);
		const row = { id: crypto.randomUUID(), value: "rpc-condition" };

		await client.call("create", {
			service: discovered.serviceId,
			resource: discovered.resourceIds.conditions,
			data: row,
		});

		const got = await client.call("get", {
			service: discovered.serviceId,
			resource: discovered.resourceIds.conditions,
		});

		expect(got).toEqual([row]);
		client.close();
	});

	it("returns the marketplace resource manifest", async () => {
		const client = createClient();
		await waitForOpen(client);

		const response = await client.call("resources", {});
		const discovered = discoverMarketplaceIds(response, [
			"items",
			"conditions",
		]);

		expect(discovered.serviceId).toBeTruthy();
		expect(discovered.resourceIds.items).toBeTruthy();
		expect(discovered.resourceIds.conditions).toBeTruthy();
		client.close();
	});
});
