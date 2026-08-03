import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { HookRequest } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";

import { db, schema } from "../db";
import { handleHook } from "../hooks";
import { drainPurchaseQueues } from "../purchase";
import { MARKETPLACE_RESOURCE } from "../resources";
import { appendStatus, currentStatus } from "../status";
import { makeHookRequest } from "./hookTestHelpers";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

const itemId = "00000000-0000-4000-8000-000000000001";
const baseMessageRequest = makeHookRequest(itemId);

const baseTransactionRequest: HookRequest = {
	hook: "before_create",
	resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS,
	data: {
		fk: itemId,
		resource: MARKETPLACE_RESOURCE.ITEMS,
		type: "charge",
		status: "succeeded",
		amount: 100,
		currency: "AUD",
	},
};

beforeEach(async () => {
	await drainPurchaseQueues();
	await db.delete(schema.item_status_history);
});

describe("handleHook", () => {
	it("returns ok for before_create hooks on available items", async () => {
		expect(await handleHook(baseMessageRequest)).toEqual({ ok: true });
	});

	it("vetoes before_create when the item is sold", async () => {
		await appendStatus(itemId, "sold");

		const response = await handleHook(baseMessageRequest);

		expect(response).toEqual({
			ok: false,
			reason: 'Cannot send "pending" while item status is "sold"',
		});
	});

	it("enqueues after_create reactions", async () => {
		const request: HookRequest = {
			...baseMessageRequest,
			hook: "after_create",
			data: { ...baseMessageRequest.data, value: "accept" },
		};

		expect(await handleHook(request)).toEqual({ ok: true });
		await drainPurchaseQueues();

		expect(await currentStatus(itemId)).toBe("pickup_pending");
	});

	it("returns ok for transaction before_create hooks", async () => {
		expect(await handleHook(baseTransactionRequest)).toEqual({ ok: true });
	});

	it("enqueues sold on transaction after_create for charge succeeded", async () => {
		const request: HookRequest = {
			...baseTransactionRequest,
			hook: "after_create",
		};

		expect(await handleHook(request)).toEqual({ ok: true });
		await drainPurchaseQueues();
		expect(await currentStatus(itemId)).toBe("sold");
	});

	it("ignores hooks for non-marketplace messages", async () => {
		const request: HookRequest = {
			...baseMessageRequest,
			data: { ...baseMessageRequest.data, resource: "other_svc.items" },
		};

		expect(await handleHook(request)).toEqual({ ok: true });
	});
});
