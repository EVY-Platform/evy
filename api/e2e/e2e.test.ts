import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { Client } from "rpc-websockets";
import { waitForClientOpen } from "../src/tests/wsTestHelpers";

type WSClient = InstanceType<typeof Client>;

type ItemStatusRow = {
	id: string;
	item_id: string;
	status: string;
	created_at: string;
};

type PurchaseMessage = {
	fk: string;
	type: "pickup" | "delivery" | "shipping";
	value: string;
	parent_message_id?: string;
	data?: Record<string, unknown>;
};

const MARKETPLACE_ITEMS = "marketplace.items";
const MARKETPLACE_ITEM_STATUSES = "marketplace.item_statuses";

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "web";
const CONNECTION_TIMEOUT_MS = 5000;

function rowPayload(id = crypto.randomUUID()) {
	return {
		id,
		name: "E2E Text Row",
		type: "text",
		visible: "true",
		data: { title: "Hello", text: "World" },
		visibility: "public" as const,
	};
}

function pagePayload(row_ids: string[], id = crypto.randomUUID()) {
	return {
		id,
		name: "E2E Page",
		title: "Test Page",
		row_ids,
		visibility: "public" as const,
	};
}

function flowPayload(page_ids: string[], id = crypto.randomUUID()) {
	return {
		id,
		name: "E2E Test Flow",
		page_ids,
		visibility: "public" as const,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureDetail(failure: unknown): string {
	if (!isRecord(failure)) return String(failure);
	return [failure.message, failure.data]
		.filter((part): part is string => typeof part === "string")
		.join(": ");
}

function latestItemStatus(rows: ItemStatusRow[]): string {
	if (rows.length === 0) return "available";
	const sorted = [...rows].sort(
		(a, b) =>
			a.created_at.localeCompare(b.created_at) ||
			a.id.localeCompare(b.id),
	);
	return sorted.at(-1)?.status ?? "available";
}

async function pollUntil<T>(
	fn: () => Promise<T>,
	predicate: (value: T) => boolean,
	options?: { timeoutMs?: number; intervalMs?: number },
): Promise<T> {
	const timeoutMs = options?.timeoutMs ?? 10_000;
	const intervalMs = options?.intervalMs ?? 100;
	const deadline = Date.now() + timeoutMs;
	let lastValue: T | undefined;
	while (Date.now() < deadline) {
		lastValue = await fn();
		if (predicate(lastValue)) return lastValue;
		await Bun.sleep(intervalMs);
	}
	throw new Error(
		`pollUntil timed out after ${timeoutMs}ms (last: ${JSON.stringify(lastValue)})`,
	);
}

describe("API E2E Tests", () => {
	describe("Public", () => {
		let unauthClient: WSClient;

		beforeAll(async () => {
			unauthClient = new Client(API_URL);
			await waitForClientOpen(unauthClient, CONNECTION_TIMEOUT_MS);
		});

		afterAll(() => {
			unauthClient.close();
		});

		it("get should succeed without auth (public)", async () => {
			const result = await unauthClient.call("get", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
			});
			expect(Array.isArray(result)).toBe(true);
		});

		it("sync is reachable as a top-level method and issues a cursor", async () => {
			const result = (await unauthClient.call("sync", {})) as {
				data: unknown[];
				cursor: string;
			};

			expect(Array.isArray(result.data)).toBe(true);
			expect(typeof result.cursor).toBe("string");
			expect(result.cursor.length).toBeGreaterThan(0);
		});

		it("a returned cursor resumes the next sync", async () => {
			const first = (await unauthClient.call("sync", {})) as {
				cursor: string;
			};
			const second = (await unauthClient.call("sync", {
				cursor: first.cursor,
			})) as { data: unknown[]; cursor: string };

			const incrementalRows = second.data.filter(
				(row) =>
					!(
						typeof row === "object" &&
						row !== null &&
						"resource" in row &&
						row.resource === EVY_CORE_RESOURCE_REF.RESOURCES
					),
			);

			expect(incrementalRows).toEqual([]);
			expect(second.cursor).toBe(first.cursor);
		});

		it("api{method:sync} is rejected", async () => {
			await expect(
				unauthClient.call("api", {
					service: EVY_CORE_SERVICE,
					method: "sync",
					data: { cursor: "1970-01-01T00:00:00.000Z" },
				}),
			).rejects.toThrow();
		});

		it("create should reject without auth", async () => {
			try {
				await unauthClient.call("create", {
					resource: EVY_CORE_RESOURCE_REF.FLOWS,
					data: flowPayload([]),
				});
				throw new Error(
					"Expected create to fail for unauthenticated request",
				);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("Expected create to fail")
				) {
					throw error;
				}
				expect(error).toBeDefined();
			}
		});
	});

	describe("Authenticated", () => {
		let client: WSClient;

		beforeAll(async () => {
			client = new Client(API_URL);
			await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
			await client.login({ token: TEST_TOKEN, os: TEST_OS });
		});

		afterAll(() => {
			client.close();
		});

		it("get flows should return flat flow records with valid structure", async () => {
			const page = pagePayload([]);
			const flow = flowPayload([page.id]);

			await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.PAGES,
				data: page,
			});
			await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
				data: flow,
			});

			const result = await client.call("get", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
				filter: { id: flow.id },
			});

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: flow.id,
				name: flow.name,
				page_ids: [page.id],
			});
			expect(result[0].created_at).toBeDefined();
			expect(result[0].updated_at).toBeDefined();
		});

		it("create flat flow resources should create rows, pages, and flows", async () => {
			const row = rowPayload();
			const page = pagePayload([row.id]);
			const flow = flowPayload([page.id]);

			const createdRow = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.ROWS,
				data: row,
			});
			const createdPage = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.PAGES,
				data: page,
			});
			const createdFlow = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
				data: flow,
			});

			expect(createdRow).toMatchObject({
				id: row.id,
				name: row.name,
				type: row.type,
				data: row.data,
			});
			expect(createdPage).toMatchObject({
				id: page.id,
				name: page.name,
				row_ids: [row.id],
			});
			expect(createdFlow).toMatchObject({
				id: flow.id,
				name: flow.name,
				page_ids: [page.id],
			});
			expect(createdFlow.created_at).toBeDefined();
			expect(createdFlow.updated_at).toBeDefined();
		});

		it("update flows should update an existing flat flow", async () => {
			const flow = flowPayload([]);

			const created = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
				data: flow,
			});

			const updated = await client.call("update", {
				resource: EVY_CORE_RESOURCE_REF.FLOWS,
				filter: { id: created.id },
				data: { ...flow, name: "Updated Flow Name" },
			});

			expect(updated.name).toBe("Updated Flow Name");
			expect(updated.page_ids).toEqual([]);
		});

		it("sync delivers a response to the sender of the message it answers", async () => {
			const itemResourceRef = "e2e_svc.items";
			const itemId = crypto.randomUUID();

			const request = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: {
					fk: itemId,
					resource: itemResourceRef,
					visibility: "private",
					type: "pickup",
					value: "pending",
					data: {},
				},
			});

			const response = await client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: {
					fk: itemId,
					resource: itemResourceRef,
					parent_message_id: request.id,
					visibility: "private",
					type: "pickup",
					value: "accept",
					data: {},
				},
			});

			const synced = await client.call("sync", {
				owned_resources: [
					{
						resource: EVY_CORE_RESOURCE_REF.MESSAGES,
						ids: [request.id],
					},
				],
			});

			const messages =
				synced.data.find(
					(row: { resource: string }) =>
						row.resource === EVY_CORE_RESOURCE_REF.MESSAGES,
				)?.value ?? [];
			const ids = messages.map((message: { id: string }) => message.id);

			expect(ids).toContain(request.id);
			expect(ids).toContain(response.id);

			const delivered = messages.find(
				(message: { id: string }) => message.id === response.id,
			);
			expect(delivered.parent_message_id).toBe(request.id);
			expect(delivered).toMatchObject({
				value: "accept",
				type: "pickup",
			});
		});

		describe("purchase status machine", () => {
			async function createMarketplaceItem(itemId = crypto.randomUUID()) {
				const payload = {
					id: itemId,
					title: `e2e-purchase-${itemId.slice(0, 8)}`,
				};
				const created = await client.call("create", {
					resource: MARKETPLACE_ITEMS,
					filter: { id: itemId },
					data: payload,
				});
				return { id: itemId, payload, created };
			}

			async function getMarketplaceItem(itemId: string) {
				const rows = await client.call("get", {
					resource: MARKETPLACE_ITEMS,
					filter: { id: itemId },
				});
				expect(rows).toHaveLength(1);
				return rows[0];
			}

			async function getItemStatusRows(
				itemId: string,
			): Promise<ItemStatusRow[]> {
				const rows = (await client.call("get", {
					resource: MARKETPLACE_ITEM_STATUSES,
				})) as ItemStatusRow[];
				return rows.filter((row) => row.item_id === itemId);
			}

			async function pollItemStatus(
				itemId: string,
				expectedStatus: string,
			): Promise<ItemStatusRow[]> {
				return pollUntil(
					() => getItemStatusRows(itemId),
					(rows) => latestItemStatus(rows) === expectedStatus,
				);
			}

			async function createPurchaseMessage(message: PurchaseMessage) {
				return client.call("create", {
					resource: EVY_CORE_RESOURCE_REF.MESSAGES,
					data: {
						fk: message.fk,
						resource: MARKETPLACE_ITEMS,
						type: message.type,
						value: message.value,
						parent_message_id: message.parent_message_id,
						visibility: "private",
						data: message.data ?? {},
					},
				});
			}

			async function driveDeliveryToSold(itemId: string) {
				const pending = await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "pending",
				});
				await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "accept",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "delivery_pending");
				await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "charge_initiated",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "sold");
				return pending;
			}

			it("pickup flow advances status through simulated payment messages", async () => {
				const { id: itemId, payload } = await createMarketplaceItem();

				const pending = await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "pending",
				});
				const accept = await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "accept",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "pickup_pending");

				const transaction = await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "transaction",
					parent_message_id: pending.id,
				});
				const transactionCompleted = await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "transaction_completed",
					parent_message_id: transaction.id,
				});
				await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "charge_initiated",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "sold");
				await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "transfer_initiated",
					parent_message_id: pending.id,
				});

				expect(accept.parent_message_id).toBe(pending.id);
				expect(transaction.parent_message_id).toBe(pending.id);
				expect(transactionCompleted.parent_message_id).toBe(
					transaction.id,
				);

				const itemAfter = await getMarketplaceItem(itemId);
				expect(itemAfter).toMatchObject(payload);
			});

			it("delivery flow advances status through simulated payment messages", async () => {
				const { id: itemId, payload } = await createMarketplaceItem();

				const pending = await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "pending",
				});
				const accept = await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "accept",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "delivery_pending");

				await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "charge_initiated",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "sold");

				const given = await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "given",
					parent_message_id: pending.id,
				});
				const received = await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "received",
					parent_message_id: pending.id,
				});
				await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "transfer_initiated",
					parent_message_id: pending.id,
				});

				expect(accept.parent_message_id).toBe(pending.id);
				expect(given.parent_message_id).toBe(pending.id);
				expect(received.parent_message_id).toBe(pending.id);

				const itemAfter = await getMarketplaceItem(itemId);
				expect(itemAfter).toMatchObject(payload);
			});

			it("shipping flow advances status through simulated payment messages", async () => {
				const { id: itemId, payload } = await createMarketplaceItem();

				const pending = await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "pending",
				});
				const accept = await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "accept",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "shipping_pending");

				await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "charge_initiated",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "sold");

				const sent = await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "sent",
					parent_message_id: pending.id,
				});
				await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "transfer_initiated",
					parent_message_id: pending.id,
				});
				const received = await createPurchaseMessage({
					fk: itemId,
					type: "shipping",
					value: "received",
					parent_message_id: pending.id,
				});

				expect(accept.parent_message_id).toBe(pending.id);
				expect(sent.parent_message_id).toBe(pending.id);
				expect(received.parent_message_id).toBe(pending.id);

				const itemAfter = await getMarketplaceItem(itemId);
				expect(itemAfter).toMatchObject(payload);
			});

			it("vetoes pending on a sold item with the marketplace reason", async () => {
				const { id: itemId } = await createMarketplaceItem();
				await driveDeliveryToSold(itemId);
				const vetoMessageId = crypto.randomUUID();

				const failure = await client
					.call("create", {
						resource: EVY_CORE_RESOURCE_REF.MESSAGES,
						filter: { id: vetoMessageId },
						data: {
							fk: itemId,
							resource: MARKETPLACE_ITEMS,
							type: "pickup",
							value: "pending",
							visibility: "private",
							data: {},
						},
					})
					.catch((error: unknown) => error);

				expect(failureDetail(failure)).toContain(
					'Cannot send "pending" while item status is "sold"',
				);

				const rows = await client.call("get", {
					resource: EVY_CORE_RESOURCE_REF.MESSAGES,
					filter: { id: vetoMessageId },
				});
				expect(rows).toHaveLength(0);
			});

			it("rolls back to available on given_failed after sold", async () => {
				const { id: itemId } = await createMarketplaceItem();
				const pending = await driveDeliveryToSold(itemId);

				await createPurchaseMessage({
					fk: itemId,
					type: "delivery",
					value: "given_failed",
					parent_message_id: pending.id,
				});
				await pollItemStatus(itemId, "available");
			});

			it("fresh sync includes item_statuses rows after accept", async () => {
				const { id: itemId } = await createMarketplaceItem();
				const pending = await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "pending",
				});
				await createPurchaseMessage({
					fk: itemId,
					type: "pickup",
					value: "accept",
					parent_message_id: pending.id,
				});
				const statusRows = await pollItemStatus(
					itemId,
					"pickup_pending",
				);

				const synced = (await client.call("sync", {})) as {
					data: { resource: string; value: unknown[] }[];
				};
				const syncedStatuses = synced.data.find(
					(row) => row.resource === MARKETPLACE_ITEM_STATUSES,
				)?.value as ItemStatusRow[] | undefined;

				expect(syncedStatuses).toBeDefined();
				const matching = syncedStatuses?.filter(
					(row) => row.item_id === itemId,
				);
				expect(matching?.length).toBe(statusRows.length);
				expect(latestItemStatus(matching ?? [])).toBe("pickup_pending");
			});
		});
	});
});
