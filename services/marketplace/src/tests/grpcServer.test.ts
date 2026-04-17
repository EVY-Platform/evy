import { createServer } from "node:net";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Client, ClientReadableStream, ServiceError } from "@grpc/grpc-js";

import * as schema from "../db/schema";
import { createEvyServiceClient } from "../grpc";
import { createPgliteTestDatabase } from "./dbTestHelpers";

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				server.close();
				reject(new Error("Could not get free port"));
				return;
			}
			const port = addr.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	db: testDb,
	schema,
}));

const { startMarketplaceGrpcServer, stopMarketplaceGrpcServer } = await import(
	"../grpc"
);

let grpcPort: number;

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
	grpcPort = await getFreePort();
	await startMarketplaceGrpcServer({ host: "127.0.0.1", port: grpcPort });
});

afterAll(async () => {
	stopMarketplaceGrpcServer();
	await pgliteClient.close();
});

beforeEach(async () => {
	await testDb.delete(schema.data);
});

type EvyServiceClient = Client & {
	Get: (
		req: {
			namespace: string;
			resource: string;
			filter?: { id: string };
		},
		cb: (err: ServiceError | null, res?: { result_json: string }) => void,
	) => void;
	Upsert: (
		req: {
			namespace: string;
			resource: string;
			filter?: { id: string };
			data_json: string;
		},
		cb: (err: ServiceError | null, res?: { result_json: string }) => void,
	) => void;
	SubscribeEvents: (req: Record<string, never>) => ClientReadableStream<{
		event_name: string;
		payload_json: string;
	}>;
};

describe("marketplace gRPC server", () => {
	it("Get and Upsert round-trip typed params", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const row = { id: crypto.randomUUID(), value: "grpc-condition" };

		await new Promise<void>((resolve, reject) => {
			client.Upsert(
				{
					namespace: "marketplace",
					resource: "conditions",
					data_json: JSON.stringify(row),
				},
				(err: ServiceError | null) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});

		const got = await new Promise<unknown>((resolve, reject) => {
			client.Get(
				{
					namespace: "marketplace",
					resource: "conditions",
				},
				(err: ServiceError | null, res?: { result_json: string }) => {
					if (err) {
						reject(err);
						return;
					}
					if (!res) {
						reject(new Error("empty Get response"));
						return;
					}
					resolve(JSON.parse(res.result_json));
				},
			);
		});

		expect(got).toEqual([row]);
	});

	it("SubscribeEvents receives dataUpdated after catalog upsert", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const received: { event_name: string; payload_json: string }[] = [];
		const stream = client.SubscribeEvents({});

		stream.on("data", (msg: { event_name: string; payload_json: string }) => {
			received.push(msg);
		});

		await new Promise((r) => setTimeout(r, 50));

		const row = { id: crypto.randomUUID(), value: "notify-me" };
		await new Promise<void>((resolve, reject) => {
			client.Upsert(
				{
					namespace: "marketplace",
					resource: "conditions",
					data_json: JSON.stringify(row),
				},
				(err: ServiceError | null) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});

		await new Promise((r) => setTimeout(r, 150));
		expect(received.some((e) => e.event_name === "dataUpdated")).toBe(true);
		const dataEvent = received.find((e) => e.event_name === "dataUpdated");
		expect(dataEvent).toBeDefined();
		if (!dataEvent) {
			return;
		}
		expect(JSON.parse(dataEvent.payload_json)).toMatchObject({
			namespace: "marketplace",
			resource: "condition",
			data: row,
		});
	});
});
