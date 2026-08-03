import type { DATA_EVY_Transaction, PaymentIntentRequest } from "evy-types";
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

export function stashEnv(
	values: Record<string, string | undefined>,
): () => void {
	const originals = new Map<string, string | undefined>();
	for (const [key, value] of Object.entries(values)) {
		originals.set(key, process.env[key]);
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
	return () => {
		for (const [key, original] of originals) {
			if (original === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = original;
			}
		}
	};
}

export function validTransactionPayload(
	overrides: Partial<
		Omit<
			DATA_EVY_Transaction,
			"id" | "created_at" | "updated_at" | "deleted_at"
		>
	> = {},
): Omit<
	DATA_EVY_Transaction,
	"id" | "created_at" | "updated_at" | "deleted_at"
> {
	return {
		fk: crypto.randomUUID(),
		resource: "test_svc.items",
		type: "charge",
		status: "intent",
		amount: 250,
		currency: "AUD",
		payment_provider_fee: 0,
		service_fee: 0,
		payment_provider: "stripe",
		payment_provider_transaction_id: crypto.randomUUID(),
		signature: "signed",
		authorization_message_id: crypto.randomUUID(),
		visibility: "public",
		...overrides,
	};
}

export function validPaymentIntentRequest(
	overrides: Partial<PaymentIntentRequest> = {},
): PaymentIntentRequest {
	return {
		fk: crypto.randomUUID(),
		resource: "marketplace.items",
		amount: 250,
		currency: "AUD",
		authorization_message_id: crypto.randomUUID(),
		...overrides,
	};
}

export async function seedAuthorizationMessage(
	testDb: PgliteTestDb,
	request: PaymentIntentRequest,
): Promise<void> {
	const nowIso = new Date().toISOString();
	await testDb.insert(schema.message).values({
		id: request.authorization_message_id,
		fk: request.fk,
		resource: request.resource,
		type: "pickup",
		value: "pending",
		data: {},
		visibility: "private",
		created_at: nowIso,
		updated_at: nowIso,
	});
}
