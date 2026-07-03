import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import type { Client, ClientReadableStream, ServiceError } from "@grpc/grpc-js";
import { migrate } from "drizzle-orm/pglite/migrator";

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

type JsonUnaryCallback = (
	err: ServiceError | null,
	res?: { result_json: string },
) => void;

type VoidUnaryCallback = (err: ServiceError | null) => void;

type EvyServiceClient = Client & {
	Get: (
		req: {
			service: string;
			resource: string;
			filter?: { id: string };
		},
		cb: JsonUnaryCallback,
	) => void;
	Create: (
		req: {
			service: string;
			resource: string;
			filter?: { id: string };
			data_json: string;
		},
		cb: VoidUnaryCallback,
	) => void;
	Update: (
		req: {
			service: string;
			resource: string;
			filter: { id: string };
			data_json: string;
		},
		cb: JsonUnaryCallback,
	) => void;
	Delete: (
		req: {
			service: string;
			resource: string;
			filter: { id: string };
		},
		cb: JsonUnaryCallback,
	) => void;
	SubscribeEvents: (req: Record<string, never>) => ClientReadableStream<{
		event_name: string;
		payload_json: string;
	}>;
};

function callVoid(call: (cb: VoidUnaryCallback) => void): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		call((err) => {
			if (err) reject(err);
			else resolve();
		});
	});
}

function callJson<T>(call: (cb: JsonUnaryCallback) => void): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		call((err, res) => {
			if (err) {
				reject(err);
				return;
			}
			if (!res) {
				reject(new Error("empty gRPC JSON response"));
				return;
			}
			resolve(JSON.parse(res.result_json) as T);
		});
	});
}

describe("marketplace gRPC server", () => {
	it("Create and Get round-trip typed params", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const row = { id: crypto.randomUUID(), value: "grpc-condition" };

		await callVoid((cb) =>
			client.Create(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
					data_json: JSON.stringify(row),
				},
				cb,
			),
		);

		const got = await callJson<unknown>((cb) =>
			client.Get(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
				},
				cb,
			),
		);

		expect(got).toEqual([row]);
	});

	it("Delete removes a created resource", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const rowId = crypto.randomUUID();
		const row = { id: rowId, value: "delete-condition" };

		await callVoid((cb) =>
			client.Create(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
					filter: { id: rowId },
					data_json: JSON.stringify(row),
				},
				cb,
			),
		);

		const deleted = await callJson<unknown>((cb) =>
			client.Delete(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
					filter: { id: rowId },
				},
				cb,
			),
		);

		expect(deleted).toMatchObject({ id: rowId, data: row });
	});

	it("SubscribeEvents receives dataChanged after resource create", async () => {
		const client = createEvyServiceClient(
			`127.0.0.1:${grpcPort}`,
		) as EvyServiceClient;
		const received: { event_name: string; payload_json: string }[] = [];
		const stream = client.SubscribeEvents({});

		stream.on(
			"data",
			(msg: { event_name: string; payload_json: string }) => {
				received.push(msg);
			},
		);

		await new Promise((r) => setTimeout(r, 50));

		const row = { id: crypto.randomUUID(), value: "notify-me" };
		await callVoid((cb) =>
			client.Create(
				{
					service: MARKETPLACE_SERVICE,
					resource: MARKETPLACE_RESOURCE.CONDITIONS,
					data_json: JSON.stringify(row),
				},
				cb,
			),
		);

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
