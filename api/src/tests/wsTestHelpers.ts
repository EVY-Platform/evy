import { afterAll, beforeAll, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { UI_RowAction } from "evy-types";
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

export function nowIso(): string {
	return new Date().toISOString();
}

export function action(expr: string): UI_RowAction {
	return { condition: "", false: "", true: expr };
}

export function setupMigrationTest(sqlFilename: string) {
	const { pgliteClient, testDb } = createPgliteTestDatabase();
	const migrationSql = readFileSync(
		join(import.meta.dir, "../../drizzle", sqlFilename),
		"utf8",
	);

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		await clearAllTestTables(testDb);
	});

	afterAll(async () => {
		await pgliteClient.close();
	});

	beforeEach(async () => {
		await clearAllTestTables(testDb);
	});

	const runMigration = () => pgliteClient.exec(migrationSql);

	return { pgliteClient, testDb, runMigration };
}

export async function insertRow(
	testDb: PgliteTestDb,
	row: {
		id: string;
		name: string;
		type: string;
		visible?: string;
		data: Record<string, unknown>;
	},
): Promise<void> {
	const iso = nowIso();
	await testDb.insert(schema.row).values({
		id: row.id,
		name: row.name,
		type: row.type,
		visible: row.visible ?? "true",
		data: row.data,
		createdAt: iso,
		updatedAt: iso,
	});
}

export async function clearAllTestTables(testDb: PgliteTestDb): Promise<void> {
	await testDb.delete(schema.row);
	await testDb.delete(schema.page);
	await testDb.delete(schema.flow);
	await testDb.delete(schema.serviceResource);
	await testDb.delete(schema.serviceProvider);
	await testDb.delete(schema.organization);
	await testDb.delete(schema.service);
	await testDb.delete(schema.device);
	await testDb.delete(schema.file);
}
