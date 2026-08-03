import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import type { ResourcesResponse } from "evy-types";
import { getFreePort } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { db, schema } from "../db";
import { drainPurchaseQueues } from "../purchase";
import { MARKETPLACE_RESOURCE } from "../resources";
import { makeHookRequest } from "./hookTestHelpers";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

const { startMarketplaceRpcServer, stopMarketplaceRpcServer } = await import(
	"../rpc"
);

let wsPort: number;

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
	wsPort = await getFreePort();
	await startMarketplaceRpcServer({ host: "127.0.0.1", port: wsPort });
});

afterAll(async () => {
	stopMarketplaceRpcServer();
});

beforeEach(async () => {
	await drainPurchaseQueues();
	await db.delete(schema.data);
	await db.delete(schema.item_status_history);
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

		expect(resources.map((entry) => entry.id)).toEqual(
			Object.values(MARKETPLACE_RESOURCE),
		);
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
		const itemStatuses = resources.find(
			(entry) => entry.id === MARKETPLACE_RESOURCE.ITEM_STATUSES,
		);
		expect(itemStatuses?.visibility).toBe("internal");
		expect(items?.visibility).toBe("public");
		expect(conditions?.visibility).toBe("public");
		client.close();
	});

	it("accepts a valid hook request and rejects garbage", async () => {
		const client = createClient();
		await waitForOpen(client);

		const hookRequest = makeHookRequest(crypto.randomUUID());

		const response = await client.call("hook", hookRequest);
		expect(response).toEqual({ ok: true });

		await expect(client.call("hook", { hook: "nope" })).rejects.toThrow();

		client.close();
	});

	it("vetoes before_create when item status blocks the message", async () => {
		const client = createClient();
		await waitForOpen(client);
		const itemId = crypto.randomUUID();

		await db.insert(schema.item_status_history).values({
			item_id: itemId,
			status: "sold",
			created_at: new Date().toISOString(),
		});

		const hookRequest = makeHookRequest(itemId);

		const response = await client.call("hook", hookRequest);
		expect(response).toEqual({
			ok: false,
			reason: 'Cannot send "pending" while item status is "sold"',
		});

		client.close();
	});
});
