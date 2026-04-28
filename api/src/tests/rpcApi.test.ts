import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { GetResponse } from "evy-types";

const forwardGetMock = mock(
	async (
		_serviceName: string,
		params: {
			service: string;
			resource: string;
			method: string;
			filter?: { query?: string };
		},
	): Promise<GetResponse> => [
		{ id: "query", value: params.filter?.query ?? "" },
	],
);

mock.module("../services", () => ({
	forwardGet: forwardGetMock,
	forwardUpsert: mock(),
	wireGrpcClientsTo: mock(),
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

	it("forwards marketplace API function requests to the owning service", async () => {
		const result = await api({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				query: "iph",
			},
		});

		expect(result).toEqual([{ id: "query", value: "iph" }]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith("marketplace", {
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				query: "iph",
			},
		});
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api({
				service: "marketplace",
				resource: "items",
				filter: {
					query: "iph",
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
				method: "suggestions",
				filter: {
					query: "iph",
				},
			}),
		).rejects.toThrow("Invalid service and resource combination");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});
});
