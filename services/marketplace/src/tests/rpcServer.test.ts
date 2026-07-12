import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Client } from "rpc-websockets";

import { schema } from "../db";
import { createPgliteTestDatabase } from "./dbTestHelpers";
import { getFreePort } from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	data: schema.data,
	db: testDb,
	schema,
}));

import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../resources";

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
		const row = { id: crypto.randomUUID(), value: "rpc-condition" };

		await client.call("create", {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});

		const got = await client.call("get", {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
		});

		expect(got).toEqual([row]);
		client.close();
	});

	it("Delete removes a created resource", async () => {
		const client = createClient();
		await waitForOpen(client);
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "delete-condition" };

		await client.call("create", {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
			data: row,
		});

		const deleted = await client.call("delete", {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			filter: { id: rowId },
		});

		expect(deleted).toMatchObject({ id: rowId, data: row });
		client.close();
	});

	it("dataChanged notification fires after resource create", async () => {
		const client = createClient();
		await waitForOpen(client);
		await client.subscribe("dataChanged");

		const row = { id: crypto.randomUUID(), value: "notify-me" };
		const eventPromise = new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				client.removeAllListeners("dataChanged");
				reject(new Error("timeout waiting for dataChanged"));
			}, 5000);
			client.once("dataChanged", (payload: unknown) => {
				clearTimeout(timeout);
				resolve(payload);
			});
		});

		await client.call("create", {
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			data: row,
		});

		expect(await eventPromise).toEqual({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			operation: "create",
			value: row,
		});
		client.close();
	});
});
