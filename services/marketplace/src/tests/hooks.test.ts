import { describe, expect, it, spyOn } from "bun:test";
import type { HookRequest } from "evy-types";
import { EVY_CORE_RESOURCE_REF } from "evy-types/coreResources";
import { handleHook } from "../hooks";

const baseRequest: HookRequest = {
	hook: "before_create",
	resource: EVY_CORE_RESOURCE_REF.MESSAGES,
	operation: "create",
	data: {
		fk: "00000000-0000-4000-8000-000000000001",
		resource: "marketplace.items",
		type: "pickup",
		value: "pending",
		data: { time: "2026-06-03T09:00:00" },
		visibility: "private",
	},
};

describe("handleHook", () => {
	it("returns ok for before_create hooks", () => {
		expect(handleHook(baseRequest)).toEqual({ ok: true });
	});

	it("returns ok and logs for after_create hooks", () => {
		const infoSpy = spyOn(console, "info").mockImplementation(() => {});
		const request: HookRequest = { ...baseRequest, hook: "after_create" };

		expect(handleHook(request)).toEqual({ ok: true });
		expect(infoSpy).toHaveBeenCalledWith(
			`[marketplace] create on ${EVY_CORE_RESOURCE_REF.MESSAGES}`,
			request.data,
		);

		infoSpy.mockRestore();
	});
});
