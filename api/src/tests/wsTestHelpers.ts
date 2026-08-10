import { afterAll, afterEach, beforeAll, beforeEach } from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type {
	DATA_EVY_Transaction,
	HookRequest,
	HookResponse,
	PaymentCaptureResponse,
	PaymentIntentRequest,
	PaymentIntentResponse,
} from "evy-types";
import * as schema from "evy-types/db/schema.generated";
import { buildTransactionSignature } from "evy-types/paymentSignature";
import {
	createPgliteTestDatabase as createPgliteTestDatabaseWithSchema,
	getFreePort,
	waitForClientOpen,
} from "evy-types/wsTestHelpers";
import { Client, Server } from "rpc-websockets";
import type { EvyDb } from "../database/db";
import { paymentCapture, paymentIntent } from "../procedures/payments";
import { setStripeGatewayForTests } from "../procedures/stripeGateway";
import { createMockStripeGateway } from "../procedures/stripeGatewayMock";
import { EXTERNAL_TEST_SERVICE_ID } from "./externalServiceFixture";

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
	const authorization_message_id =
		overrides.authorization_message_id ?? crypto.randomUUID();
	const amount = overrides.amount ?? 250;
	const currency = overrides.currency ?? "AUD";
	return {
		fk: crypto.randomUUID(),
		resource: "test_svc.items",
		type: "charge",
		status: "intent",
		amount,
		currency,
		payment_provider_fee: 0,
		service_fee: 0,
		payment_provider: "stripe",
		payment_provider_transaction_id: crypto.randomUUID(),
		signature: buildTransactionSignature({
			amount,
			currency,
			authorization_message_id,
			created_at: new Date().toISOString(),
			payment_provider: "stripe",
			payment_method_last_4_characters: "4242",
		}),
		authorization_message_id,
		visibility: "public",
		...overrides,
	};
}

export function validPaymentIntentRequest(
	overrides: Partial<PaymentIntentRequest> = {},
): PaymentIntentRequest {
	const authorization_message_id =
		overrides.authorization_message_id ?? crypto.randomUUID();
	const amount = overrides.amount ?? 250;
	const currency = overrides.currency ?? "AUD";
	return {
		fk: overrides.fk ?? crypto.randomUUID(),
		resource: overrides.resource ?? "marketplace.items",
		amount,
		currency,
		authorization_message_id,
		signature:
			overrides.signature ??
			buildTransactionSignature({
				amount,
				currency,
				authorization_message_id,
				created_at: new Date().toISOString(),
				payment_provider: "stripe",
				payment_method_last_4_characters: "4242",
			}),
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

/**
 * Bootstraps a per-file pglite database plus the mock Stripe gateway
 * lifecycle. Must be called at the top level of a test module so the
 * bun:test hooks it registers apply to the whole file.
 */
export function setupPaymentTestDb(): { testDb: PgliteTestDb; dataDb: EvyDb } {
	const { pgliteClient, testDb } = createPgliteTestDatabase();
	const dataDb = asEvyDb(testDb);

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
	});

	afterAll(async () => {
		await pgliteClient.close();
	});

	beforeEach(async () => {
		await clearAllTestTables(testDb);
		setStripeGatewayForTests(createMockStripeGateway());
	});

	afterEach(() => {
		setStripeGatewayForTests(undefined);
	});

	return { testDb, dataDb };
}

/** request -> seeded authorization message -> payment intent. */
export async function createSeededIntent(
	testDb: PgliteTestDb,
	dataDb: EvyDb,
	overrides: Partial<PaymentIntentRequest> = {},
): Promise<{
	request: PaymentIntentRequest;
	intent: PaymentIntentResponse;
	intentId: string;
}> {
	const request = validPaymentIntentRequest(overrides);
	await seedAuthorizationMessage(testDb, request);
	const intent = await paymentIntent(request, dataDb);
	return {
		request,
		intent,
		intentId: intent.payment_provider_transaction_id,
	};
}

/** `createSeededIntent` followed by a successful capture. */
export async function createCapturedIntent(
	testDb: PgliteTestDb,
	dataDb: EvyDb,
	overrides: Partial<PaymentIntentRequest> = {},
): Promise<{
	request: PaymentIntentRequest;
	intent: PaymentIntentResponse;
	intentId: string;
	captured: PaymentCaptureResponse;
}> {
	const seeded = await createSeededIntent(testDb, dataDb, overrides);
	const captured = await paymentCapture(
		{ payment_intent_id: seeded.intentId },
		dataDb,
	);
	return { ...seeded, captured };
}

export async function seedMarketplaceService(
	testDb: PgliteTestDb,
): Promise<void> {
	const nowIso = new Date().toISOString();
	await testDb.insert(schema.service).values({
		id: EXTERNAL_TEST_SERVICE_ID,
		name: "marketplace",
		description: "Marketplace",
		sort_order: 1,
		visibility: "public",
		created_at: nowIso,
		updated_at: nowIso,
	});
}

type HookWsServer = InstanceType<typeof Server>;

/**
 * Full service-hook harness: own pglite database, marketplace service row,
 * a ws server the api dials as the service, and service adapters wired to
 * it via stashed env. Registers a `hook` method when `hookHandler` is given.
 * Must be called synchronously inside a `describe` (or at module top level)
 * so the bun:test hooks it registers attach to that scope.
 */
export function setupHookServiceHarness(
	options: { hookHandler?: (params: HookRequest) => HookResponse } = {},
): { testDb: PgliteTestDb; dataDb: EvyDb } {
	const { pgliteClient, testDb } = createPgliteTestDatabase();
	const dataDb = asEvyDb(testDb);
	let testServer: HookWsServer | null = null;
	let restoreEnv: (() => void) | undefined;

	beforeAll(async () => {
		await migrate(testDb, { migrationsFolder: "./drizzle" });
		const wsPort = await getFreePort();
		restoreEnv = stashEnv({
			MARKETPLACE_WS_HOST: "127.0.0.1",
			MARKETPLACE_WS_PORT: String(wsPort),
			SERVICE_RPC_TIMEOUT_MS: "200",
		});
		await seedMarketplaceService(testDb);

		testServer = await new Promise<HookWsServer>((resolve, reject) => {
			const wsServer = new Server({ host: "127.0.0.1", port: wsPort });
			wsServer.on("listening", () => resolve(wsServer));
			wsServer.on("error", reject);
		});
		const { hookHandler } = options;
		if (hookHandler) {
			testServer.register("hook", (params: HookRequest) =>
				hookHandler(params),
			);
		}

		const { initServiceAdapters } = await import("../procedures/services");
		await initServiceAdapters(dataDb);
	}, 20_000);

	afterAll(async () => {
		const { disposeServiceAdapters } = await import(
			"../procedures/services"
		);
		disposeServiceAdapters();
		testServer?.close();
		restoreEnv?.();
		await pgliteClient.close();
	}, 10_000);

	return { testDb, dataDb };
}
