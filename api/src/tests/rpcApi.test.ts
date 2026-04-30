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
				queryText?: string;
				ids?: string[];
				tagIds?: string[];
				limit?: number;
				offset?: number;
			};
		},
	): Promise<GetResponse> => [
		{ id: "query", value: params.filter?.queryText ?? "" },
	],
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

	it("forwards marketplace API function requests to the owning service", async () => {
		const result = await api({
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				queryText: "iph",
			},
		});

		expect(result).toEqual([{ id: "query", value: "iph" }]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith("marketplace", {
			service: "marketplace",
			resource: "items",
			method: "suggestions",
			filter: {
				queryText: "iph",
			},
		});
	});

	it("forwards marketplace item search requests to the owning service", async () => {
		const itemId = crypto.randomUUID();
		const result = await api({
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				ids: [itemId],
				tagIds: ["electronics-tag"],
				limit: 10,
				offset: 5,
			},
		});

		expect(result).toEqual([{ id: "query", value: "" }]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith("marketplace", {
			service: "marketplace",
			resource: "items",
			method: "search",
			filter: {
				ids: [itemId],
				tagIds: ["electronics-tag"],
				limit: 10,
				offset: 5,
			},
		});
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api({
				service: "marketplace",
				resource: "items",
				filter: {
					queryText: "iph",
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
					queryText: "iph",
				},
			}),
		).rejects.toThrow("Invalid service and resource combination");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});
});
