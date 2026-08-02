import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { HookRequest } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";

import { db, schema } from "../db";
import { handleHook } from "../hooks";
import { drainPurchaseQueues } from "../purchase";
import { MARKETPLACE_RESOURCE } from "../resources";
import { appendStatus, currentStatus } from "../status";
import { ensureMarketplaceTestSchema } from "./sharedTestDb";

beforeAll(async () => {
	await ensureMarketplaceTestSchema();
});

const itemId = "00000000-0000-4000-8000-000000000001";

const baseRequest: HookRequest = {
	hook: "before_create",
	resource: EVY_CORE_RESOURCE_REF.MESSAGES,
	operation: "create",
	data: {
		fk: itemId,
		resource: MARKETPLACE_RESOURCE.ITEMS,
		type: "pickup",
		value: "pending",
		data: { time: "2026-06-03T09:00:00" },
		visibility: "private",
	},
};

beforeEach(async () => {
	await drainPurchaseQueues();
	await db.delete(schema.item_status_history);
});

describe("handleHook", () => {
	it("returns ok for before_create hooks on available items", async () => {
		expect(await handleHook(baseRequest)).toEqual({ ok: true });
	});

	it("vetoes before_create when the item is sold", async () => {
		await appendStatus(itemId, "sold");

		const response = await handleHook(baseRequest);

		expect(response).toEqual({
			ok: false,
			reason: 'Cannot send "pending" while item status is "sold"',
		});
	});

	it("enqueues after_create reactions", async () => {
		const request: HookRequest = {
			...baseRequest,
			hook: "after_create",
			data: { ...baseRequest.data, value: "accept" },
		};

		expect(await handleHook(request)).toEqual({ ok: true });
		await drainPurchaseQueues();

		expect(await currentStatus(itemId)).toBe("pickup_pending");
	});

	it("ignores hooks for non-marketplace messages", async () => {
		const request: HookRequest = {
			...baseRequest,
			data: { ...baseRequest.data, resource: "other_svc.items" },
		};

		expect(await handleHook(request)).toEqual({ ok: true });
	});
});
