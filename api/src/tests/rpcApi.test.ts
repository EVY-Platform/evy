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
				id?: string;
			};
		},
	): Promise<GetResponse> =>
		params.filter?.id ? ([{ id: params.filter.id }] as GetResponse) : [],
);

const ensureRegistryInitializedMock = mock(async () => {});

mock.module("../services", () => ({
	ensureRegistryInitialized: ensureRegistryInitializedMock,
	forwardCreate: mock(),
	forwardGet: forwardGetMock,
	forwardUpdate: mock(),
	wireGrpcEvents: mock(),
}));

// Register marketplace resources so validateStrictApiRequest can find them
import { setServiceRegistry } from "evy-types/rpcRequestHelpers";
setServiceRegistry([
	[
		"marketplace",
		[
			"selling_reasons",
			"conditions",
			"durations",
			"areas",
			"timeslots",
			"items",
		],
	],
]);

const { api } = await import("../rpc");
const { resources } = await import("../resources");

describe("api JSON-RPC handler", () => {
	beforeEach(() => {
		forwardGetMock.mockClear();
		ensureRegistryInitializedMock.mockClear();
	});

	it("forwards non-search marketplace API function requests to the owning service", async () => {
		const itemId = crypto.randomUUID();
		const result = await api({
			service: "marketplace",
			resource: "items",
			method: "not-search",
			filter: {
				id: itemId,
			},
		});

		expect(result).toEqual([{ id: itemId }]);
		expect(forwardGetMock).toHaveBeenCalledTimes(1);
		expect(forwardGetMock).toHaveBeenCalledWith("marketplace", {
			service: "marketplace",
			resource: "items",
			method: "not-search",
			filter: {
				id: itemId,
			},
		});
	});

	it("rejects requests without an API method", async () => {
		await expect(
			api({
				service: "marketplace",
				resource: "items",
				filter: {
					id: crypto.randomUUID(),
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
					id: crypto.randomUUID(),
				},
			}),
		).rejects.toThrow("Invalid service and resource combination");

		expect(forwardGetMock).not.toHaveBeenCalled();
	});
});

describe("resources JSON-RPC handler", () => {
	beforeEach(() => {
		ensureRegistryInitializedMock.mockClear();
	});

	it("waits for service discovery before returning syncable services", async () => {
		const result = await resources();

		expect(ensureRegistryInitializedMock).toHaveBeenCalledTimes(1);
		expect(result.resourcesByService.marketplace).toContain("items");
		expect(result.resourcesByService.marketplace).toContain("conditions");
	});
});
