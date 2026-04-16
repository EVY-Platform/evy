import { createServer } from "node:net";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "rpc-websockets";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "../db/drizzleTables";

export type WSServer = Awaited<
	ReturnType<typeof import("../ws")["initServer"]>
>;

type RpcWSClient = InstanceType<typeof Client>;
type PgliteTestDb = PgliteDatabase<typeof schema>;

const DEFAULT_OPEN_TIMEOUT_MS = 8000;

export function getFreePort(): Promise<number> {
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

export function waitForClientOpen(
	ws: RpcWSClient,
	timeoutMs = DEFAULT_OPEN_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const onOpen = () => {
			clearTimeout(timeout);
			ws.removeListener("error", onError);
			resolve();
		};
		const onError = (err: Error) => {
			clearTimeout(timeout);
			ws.removeListener("open", onOpen);
			reject(err);
		};
		const timeout = setTimeout(() => {
			ws.removeListener("open", onOpen);
			ws.removeListener("error", onError);
			reject(new Error("WebSocket connection timeout"));
		}, timeoutMs);
		ws.on("open", onOpen);
		ws.on("error", onError);
	});
}

export function waitForNotification(
	ws: RpcWSClient,
	method: string,
	timeoutMs = 15000,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => {
			ws.removeAllListeners(method);
			reject(new Error(`timeout waiting for ${method}`));
		}, timeoutMs);
		ws.on(method, (params: unknown) => {
			clearTimeout(t);
			ws.removeAllListeners(method);
			resolve(params);
		});
	});
}

export async function connectAndLogin(
	apiUrl: string,
	token: string,
	os: string,
	subscribeTo?: string,
): Promise<RpcWSClient> {
	const ws = new Client(apiUrl);
	await waitForClientOpen(ws);
	await ws.login({ token, os });
	if (subscribeTo) await ws.subscribe(subscribeTo);
	return ws;
}

export function createPgliteTestDatabase(): {
	pgliteClient: PGlite;
	testDb: PgliteTestDb;
} {
	const pgliteClient = new PGlite();
	const testDb = drizzle(pgliteClient, { schema });
	return { pgliteClient, testDb };
}

export async function clearAllTestTables(testDb: PgliteTestDb): Promise<void> {
	await testDb.delete(schema.flow);
	await testDb.delete(schema.data);
	await testDb.delete(schema.serviceProvider);
	await testDb.delete(schema.organization);
	await testDb.delete(schema.service);
	await testDb.delete(schema.device);
}
