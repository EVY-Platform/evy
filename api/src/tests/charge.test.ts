import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "bun:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { ChargeRequest } from "evy-types";
import {
	EVY_CORE_RESOURCE_REF,
	EVY_CORE_SERVICE,
} from "evy-types/coreResources";
import * as schema from "evy-types/db/schema.generated";
import { charge } from "../procedures/charge";
import {
	asEvyDb,
	clearAllTestTables,
	createPgliteTestDatabase,
} from "./wsTestHelpers";

const { pgliteClient, testDb } = createPgliteTestDatabase();
const dataDb = asEvyDb(testDb);

const { api, get } = await import("../procedures/rpc");

beforeAll(async () => {
	await migrate(testDb, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
	await pgliteClient.close();
});

beforeEach(async () => {
	await clearAllTestTables(testDb);
});

function validChargeRequest(): ChargeRequest {
	return {
		fk: crypto.randomUUID(),
		resource: "marketplace.items",
		amount: 250,
		currency: "AUD",
		authorization_message_id: crypto.randomUUID(),
	};
}

describe("charge procedure", () => {
	it("creates a charge transaction and returns it", async () => {
		const request = validChargeRequest();
		const created = await charge(request, dataDb);

		expect(created.id).toBeDefined();
		expect(created.created_at).toBeDefined();
		expect(created.updated_at).toBeDefined();
		expect(created.type).toBe("charge");
		expect(created.fk).toBe(request.fk);
		expect(created.resource).toBe(request.resource);
		expect(created.amount).toBe(250);
		expect(created.currency).toBe("AUD");
		expect(created.authorization_message_id).toBe(
			request.authorization_message_id,
		);
		expect(created.payment_provider).toBe("stripe");
		expect(created.payment_provider_fee).toBe(0);
		expect(created.service_fee).toBe(0);
		expect(created.signature).toBe("signed");
		expect(created.visibility).toBe("public");
		expect(created.payment_provider_transaction_id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);

		const listed = await get(
			{ resource: EVY_CORE_RESOURCE_REF.TRANSACTIONS },
			dataDb,
		);
		expect(listed).toHaveLength(1);
		expect(listed[0]).toMatchObject({ id: created.id, type: "charge" });

		const [row] = await testDb.select().from(schema.transaction);
		expect(row?.id).toBe(created.id);
	});

	it("accepts a zero amount", async () => {
		const created = await charge(
			{ ...validChargeRequest(), amount: 0 },
			dataDb,
		);
		expect(created.amount).toBe(0);
	});

	it("is reachable via api{service:evy, method:charge}", async () => {
		const request = validChargeRequest();
		const created = await api(
			{
				service: EVY_CORE_SERVICE,
				method: "charge",
				data: request,
			},
			dataDb,
		);

		expect(created).toMatchObject({
			type: "charge",
			fk: request.fk,
			amount: 250,
		});
	});

	it("rejects an invalid charge request", async () => {
		await expect(
			api(
				{
					service: EVY_CORE_SERVICE,
					method: "charge",
					data: { ...validChargeRequest(), amount: -1 },
				},
				dataDb,
			),
		).rejects.toThrow("ChargeRequest validation failed");
	});
});
