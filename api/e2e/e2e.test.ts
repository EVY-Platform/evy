import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { Client } from "rpc-websockets";
import { waitForClientOpen } from "../src/tests/wsTestHelpers";

type WSClient = InstanceType<typeof Client>;

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
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
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
						row.resource === EVY_CORE_RESOURCE.RESOURCES
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
					service: EVY_CORE_SERVICE,
					resource: EVY_CORE_RESOURCE.FLOWS,
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
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.PAGES,
				data: page,
			});
			await client.call("create", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				data: flow,
			});

			const result = await client.call("get", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
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
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.ROWS,
				data: row,
			});
			const createdPage = await client.call("create", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.PAGES,
				data: page,
			});
			const createdFlow = await client.call("create", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
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
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				data: flow,
			});

			const updated = await client.call("update", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.FLOWS,
				filter: { id: created.id },
				data: { ...flow, name: "Updated Flow Name" },
			});

			expect(updated.name).toBe("Updated Flow Name");
			expect(updated.page_ids).toEqual([]);
		});

		it("sync delivers a response to the sender of the message it answers", async () => {
			const itemService = crypto.randomUUID();
			const itemResource = crypto.randomUUID();
			const itemId = crypto.randomUUID();

			const request = await client.call("create", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.MESSAGES,
				data: {
					fk: itemId,
					service: itemService,
					resource: itemResource,
					visibility: "private",
					data: { type: "pickup", value: "pending" },
				},
			});

			const response = await client.call("create", {
				service: EVY_CORE_SERVICE,
				resource: EVY_CORE_RESOURCE.MESSAGES,
				data: {
					fk: itemId,
					service: itemService,
					resource: itemResource,
					parent_message_id: request.id,
					visibility: "private",
					data: { value: "accept", type: "pickup" },
				},
			});

			const synced = await client.call("sync", {
				owned_service_resources: [
					{
						service: EVY_CORE_SERVICE,
						resource: EVY_CORE_RESOURCE.MESSAGES,
						ids: [request.id],
					},
				],
			});

			const messages =
				synced.data.find(
					(row: { resource: string }) =>
						row.resource === EVY_CORE_RESOURCE.MESSAGES,
				)?.value ?? [];
			const ids = messages.map((message: { id: string }) => message.id);

			expect(ids).toContain(request.id);
			expect(ids).toContain(response.id);

			const delivered = messages.find(
				(message: { id: string }) => message.id === response.id,
			);
			expect(delivered.parent_message_id).toBe(request.id);
			expect(delivered.data).toMatchObject({
				value: "accept",
				type: "pickup",
			});
		});
	});
});
