import * as schema from "evy-types/db/schema.generated";
import {
	createPgliteTestDatabase as createPgliteTestDatabaseWithSchema,
	waitForClientOpen,
} from "evy-types/wsTestHelpers";
import { Client } from "rpc-websockets";
import type { EvyDb } from "../database/db";

export { getFreePort, waitForClientOpen } from "evy-types/wsTestHelpers";

export type WSServer = Awaited<
	ReturnType<typeof import("../shared/ws")["initServer"]>
>;

type RpcWSClient = InstanceType<typeof Client>;
type PgliteTestDb = ReturnType<typeof createPgliteTestDatabase>["testDb"];

export function asEvyDb(db: PgliteTestDb): EvyDb {
	return db as unknown as EvyDb;
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

export function createPgliteTestDatabase() {
	return createPgliteTestDatabaseWithSchema(schema);
}

export async function clearAllTestTables(testDb: PgliteTestDb): Promise<void> {
	await testDb.delete(schema.row);
	await testDb.delete(schema.page);
	await testDb.delete(schema.flow);
	await testDb.delete(schema.service_provider);
	await testDb.delete(schema.organization);
	await testDb.delete(schema.service);
	await testDb.delete(schema.device);
	await testDb.delete(schema.file);
	await testDb.delete(schema.address);
	await testDb.delete(schema.message);
	await testDb.delete(schema.transaction);
	await testDb.delete(schema.formatter);
}
