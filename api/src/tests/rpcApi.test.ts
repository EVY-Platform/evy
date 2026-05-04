import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { GetResponse } from "evy-types";

const forwardGetMock = mock(
	async (
		_serviceName: string,
		params: {
			service: string;
			resource: string;
			method: string;
			filter?: {
				ids?: string[];
			};
		},
	): Promise<GetResponse> => params.filter?.ids ?? [],
);

mock.module("../services", () => ({
	forwardGet: forwardGetMock,
	forwardUpsert: mock(),
	wireGrpcEvents: mock(),
}));

mock.module("../data", () => ({
	getCoreForValidatedRequest: mock(),
	upsertCoreForValidatedRequest: mock(),
}));

const { api } = await import("../rpc");

describe("api JSON-RPC handler", () => {
	beforeEach(() => {
		forwardGetMock.mockClear();
	});

	it("forwards non-search marketplace API function requests to the owning service", async () => {
		const itemId = crypto.randomUUID();
		const result = await api({
			service: "marketplace",
			resource: "items",
			method: "not-search",
			filter: {
				ids: [itemId],
			},
		});

		expect(result).toEqual([itemId]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith("marketplace", {
			service: "marketplace",
			resource: "items",
			method: "not-search",
			filter: {
				ids: [itemId],
			},
		});
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api({
				service: "marketplace",
				resource: "items",
				filter: {
					ids: [crypto.randomUUID()],
				},
			}),
		).rejects.toThrow("ApiRequest validation failed");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});

	it("rejects unsupported service/resource pairs", async () => {
		await expect(
			api({
				service: "marketplace",
				resource: "sdui",
				method: "not-search",
				filter: {
					ids: [crypto.randomUUID()],
				},
			}),
		).rejects.toThrow("Invalid service and resource combination");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});
});
