import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import { MOCK_CAPTURE_FAILURE_AMOUNT } from "evy-types/paymentMocks";
import { waitForClientOpen } from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../src/resources";

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

const API_URL = process.env.API_URL;
if (!API_URL) {
	throw new Error("API_URL environment variable is not set");
}

const TEST_TOKEN = "e2e-marketplace-token";
const TEST_OS = "web";
const CONNECTION_TIMEOUT_MS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A rejected JSON-RPC call arrives as `{code, message, data}`, where `message`
 * is the error's class name and `data` carries what actually went wrong.
 */
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

describe("Marketplace E2E (via API WebSocket)", () => {
	let client: WSClient;

	beforeAll(async () => {
		client = new Client(API_URL);
		await waitForClientOpen(client, CONNECTION_TIMEOUT_MS);
		await client.login({ token: TEST_TOKEN, os: TEST_OS });
	});

	afterAll(() => {
		client.close();
	});

	it("get marketplace items resource should return an array envelope", async () => {
		const result = await client.call("get", {
			resource: MARKETPLACE_RESOURCE.ITEMS,
		});
		expect(Array.isArray(result)).toBe(true);
	});

	it("create then get marketplace items resource round-trips data", async () => {
		const testData = {
			id: crypto.randomUUID(),
			testField: "e2e test value",
			nested: { value: 123 },
		};

		const created = await client.call("create", {
			resource: MARKETPLACE_RESOURCE.ITEMS,
			data: testData,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("id");
		expect(created).toHaveProperty("data");

		const got = await client.call("get", {
			resource: MARKETPLACE_RESOURCE.ITEMS,
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got.length).toBeGreaterThan(0);
		const matchingRecord = got.find(
			(entry: unknown) =>
				isRecord(entry) &&
				entry.testField === "e2e test value" &&
				isRecord(entry.nested) &&
				entry.nested.value === 123,
		);
		expect(isRecord(matchingRecord)).toBe(true);
	});

	// The gateway forwards item payloads without inspecting them, so these
	// rejections prove the marketplace service is the one checking — and that
	// the reason survives the hop back, since it is all the caller gets.
	it("rejects an item whose known field has the wrong type", async () => {
		const failure = await client
			.call("create", {
				resource: MARKETPLACE_RESOURCE.ITEMS,
				data: { id: crypto.randomUUID(), title: 123 },
			})
			.catch((error: unknown) => error);

		expect(failureDetail(failure)).toContain("/title: must be string");
	});

	it("rejects a lookup row with an unknown key", async () => {
		const failure = await client
			.call("create", {
				resource: MARKETPLACE_RESOURCE.CONDITIONS,
				data: { id: crypto.randomUUID(), value: "Mint", extra: true },
			})
			.catch((error: unknown) => error);

		expect(failureDetail(failure)).toContain(
			"must NOT have additional propert",
		);
	});

	// The builder reads these off the catalog the gateway aggregates, so they
	// have to survive both the service hop and the api hop.
	it("exposes marketplace attributes through the API resource catalog", async () => {
		const response = (await client.call("resources", {})) as {
			services: {
				id: string;
				resources: { name: string; attributes?: string[] }[];
			}[];
		};
		const marketplace = response.services.find(
			(service) => service.id === MARKETPLACE_SERVICE,
		);
		const items = marketplace?.resources.find(
			(resource) => resource.name === "items",
		);

		expect(items?.attributes).toContain("title");
		expect(items?.attributes).toContain("price.currency");
		expect(items?.attributes).toContain(
			"transfer_options.pickup.address_id",
		);
	});

	it("creates core messages via the EVY API", async () => {
		const messageId = crypto.randomUUID();
		const message = {
			fk: crypto.randomUUID(),
			resource: MARKETPLACE_RESOURCE.ITEMS,
			type: "pickup",
			value: "pending",
			data: {
				time: "2026-06-03T10:00:00",
			},
			visibility: "private",
		};

		const created = await client.call("create", {
			resource: EVY_CORE_RESOURCE_REF.MESSAGES,
			filter: { id: messageId },
			data: message,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toMatchObject({
			id: messageId,
			type: "pickup",
			value: "pending",
			data: { time: "2026-06-03T10:00:00" },
			visibility: "private",
		});
		expect(created.updated_at).toBeDefined();

		const rows = await client.call("get", {
			resource: EVY_CORE_RESOURCE_REF.MESSAGES,
			filter: { id: messageId },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			id: messageId,
			type: "pickup",
			value: "pending",
		});
	});

	it("create marketplace item with transfer_options.pickup.address_id round-trips", async () => {
		const clientId = crypto.randomUUID();
		const addressId = crypto.randomUUID();
		const itemPayload = {
			id: clientId,
			title: "item-with-address",
			transfer_options: {
				pickup: {
					address_id: addressId,
					lead_time_hours: "24",
				},
			},
		};

		const created = await client.call("create", {
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
			data: itemPayload,
		});

		expect(isRecord(created)).toBe(true);
		expect(created).toHaveProperty("id", clientId);
		expect(created.data).toMatchObject({
			id: clientId,
			title: "item-with-address",
			transfer_options: {
				pickup: { address_id: addressId, lead_time_hours: "24" },
			},
		});
		expect(created.data).not.toHaveProperty("pickup_address");

		const got = await client.call("get", {
			resource: MARKETPLACE_RESOURCE.ITEMS,
			filter: { id: clientId },
		});

		expect(Array.isArray(got)).toBe(true);
		expect(got).toHaveLength(1);
		expect(got[0]).toMatchObject({
			id: clientId,
			title: "item-with-address",
			transfer_options: {
				pickup: { address_id: addressId },
			},
		});
		expect(got[0]).not.toHaveProperty("pickup_address");
	});

	describe("purchase status machine", () => {
		async function createMarketplaceItem() {
			const itemId = crypto.randomUUID();
			const payload = {
				id: itemId,
				title: `e2e-purchase-${itemId.slice(0, 8)}`,
			};
			await client.call("create", {
				resource: MARKETPLACE_RESOURCE.ITEMS,
				filter: { id: itemId },
				data: payload,
			});
			return { id: itemId, payload };
		}

		async function getMarketplaceItem(itemId: string) {
			const rows = await client.call("get", {
				resource: MARKETPLACE_RESOURCE.ITEMS,
				filter: { id: itemId },
			});
			expect(rows).toHaveLength(1);
			return rows[0];
		}

		async function getItemStatusRows(
			itemId: string,
		): Promise<ItemStatusRow[]> {
			const rows = (await client.call("get", {
				resource: MARKETPLACE_RESOURCE.ITEM_STATUSES,
			})) as ItemStatusRow[];
			return rows.filter((row) => row.item_id === itemId);
		}

		async function pollItemStatus(
			itemId: string,
			expectedStatus: string,
		): Promise<ItemStatusRow[]> {
			const timeoutMs = 10_000;
			const intervalMs = 100;
			const deadline = Date.now() + timeoutMs;
			let lastValue: ItemStatusRow[] | undefined;
			while (Date.now() < deadline) {
				lastValue = await getItemStatusRows(itemId);
				if (latestItemStatus(lastValue) === expectedStatus) {
					return lastValue;
				}
				await Bun.sleep(intervalMs);
			}
			throw new Error(
				`pollItemStatus timed out after ${timeoutMs}ms (last: ${JSON.stringify(lastValue)})`,
			);
		}

		async function createPurchaseMessage(message: PurchaseMessage) {
			return client.call("create", {
				resource: EVY_CORE_RESOURCE_REF.MESSAGES,
				data: {
					fk: message.fk,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					type: message.type,
					value: message.value,
					parent_message_id: message.parent_message_id,
					visibility: "private",
					data: message.data ?? {},
				},
			});
		}

		async function runPaymentCapture(
			itemId: string,
			authorizationMessageId: string,
			amount = 250,
		) {
			const intent = await client.call("api", {
				service: EVY_CORE_SERVICE,
				method: "payment_intent",
				data: {
					fk: itemId,
					resource: MARKETPLACE_RESOURCE.ITEMS,
					amount,
					currency: "AUD",
					authorization_message_id: authorizationMessageId,
				},
			});
			await client.call("api", {
				service: EVY_CORE_SERVICE,
				method: "payment_capture",
				data: {
					payment_intent_id: intent.payment_provider_transaction_id,
				},
			});
			return intent;
		}

		async function runPaymentTransfer(intent: {
			payment_provider_transaction_id: string;
		}) {
			await client.call("api", {
				service: EVY_CORE_SERVICE,
				method: "payment_transfer",
				data: {
					payment_intent_id: intent.payment_provider_transaction_id,
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
			await runPaymentCapture(itemId, pending.id);
			await pollItemStatus(itemId, "sold");
			return pending;
		}

		it("accept flips status to type_pending", async () => {
			const { id: itemId } = await createMarketplaceItem();
			const pending = await createPurchaseMessage({
				fk: itemId,
				type: "pickup",
				value: "pending",
				data: { time: "2026-06-03T10:00:00" },
			});
			await createPurchaseMessage({
				fk: itemId,
				type: "pickup",
				value: "accept",
				parent_message_id: pending.id,
			});

			await pollItemStatus(itemId, "pickup_pending");
		});

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
			const paymentIntent = await runPaymentCapture(itemId, pending.id);
			await pollItemStatus(itemId, "sold");
			await runPaymentTransfer(paymentIntent);

			expect(accept.parent_message_id).toBe(pending.id);
			expect(transaction.parent_message_id).toBe(pending.id);
			expect(transactionCompleted.parent_message_id).toBe(transaction.id);

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

			const paymentIntent = await runPaymentCapture(itemId, pending.id);
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
			await runPaymentTransfer(paymentIntent);

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

			const paymentIntent = await runPaymentCapture(itemId, pending.id);
			await pollItemStatus(itemId, "sold");

			const sent = await createPurchaseMessage({
				fk: itemId,
				type: "shipping",
				value: "sent",
				parent_message_id: pending.id,
			});
			await runPaymentTransfer(paymentIntent);
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
						resource: MARKETPLACE_RESOURCE.ITEMS,
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

		it("rolls back to available on failed after sold", async () => {
			const { id: itemId } = await createMarketplaceItem();
			const pending = await driveDeliveryToSold(itemId);

			await createPurchaseMessage({
				fk: itemId,
				type: "delivery",
				value: "failed",
				parent_message_id: pending.id,
			});
			await pollItemStatus(itemId, "available");
		});

		it("rolls back to available on capture failure via payment webhook", async () => {
			const { id: itemId } = await createMarketplaceItem();
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
			await runPaymentCapture(
				itemId,
				pending.id,
				MOCK_CAPTURE_FAILURE_AMOUNT,
			);
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
			const statusRows = await pollItemStatus(itemId, "pickup_pending");

			const synced = (await client.call("sync", {})) as {
				data: { resource: string; value: unknown[] }[];
			};
			const syncedStatuses = synced.data.find(
				(row) => row.resource === MARKETPLACE_RESOURCE.ITEM_STATUSES,
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
