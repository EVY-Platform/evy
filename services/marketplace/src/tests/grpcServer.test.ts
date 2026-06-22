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

import { getFreePort } from "../../../../api/src/tests/wsTestHelpers";
import { schema } from "../db";
import { createEvyServiceClient } from "../grpc";
import { createPgliteTestDatabase } from "./dbTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();

mock.module("../db", () => ({
	data: schema.data,
	db: testDb,
	schema,
}));

import { MARKETPLACE_RESOURCE, MARKETPLACE_SERVICE } from "../resources";

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
			service: string;
			resource: string;
			filter?: { id: string };
		},
		cb: (err: ServiceError | null, res?: { result_json: string }) => void,
	) => void;
	Create: (
		req: {
			service: string;
			resource: string;
			filter?: { id: string };
			data_json: string;
		},
		cb: (err: ServiceError | null, res?: { result_json: string }) => void,
	) => void;
	Update: (
		req: {
			service: string;
			resource: string;
			filter: { id: string };
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
	it("Create and Get round-trip typed params", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const row = { id: crypto.randomUUID(), value: "grpc-condition" };

		await new Promise<void>((resolve, reject) => {
			client.Create(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
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
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
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

	it("SubscribeEvents receives dataChanged after resource create", async () => {
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
			client.Create(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
					data_json: JSON.stringify(row),
				},
				(err: ServiceError | null) => {
					if (err) reject(err);
					else resolve();
				},
			);
		});

		await new Promise((r) => setTimeout(r, 150));
		expect(received.some((e) => e.event_name === "dataChanged")).toBe(true);
		const dataEvent = received.find((e) => e.event_name === "dataChanged");
		expect(dataEvent).toBeDefined();
		if (!dataEvent) {
			return;
		}
		expect(JSON.parse(dataEvent.payload_json)).toEqual({
			service: MARKETPLACE_SERVICE,
			resource: MARKETPLACE_RESOURCE.CONDITIONS,
			operation: "create",
			value: row,
		});
	});
});
