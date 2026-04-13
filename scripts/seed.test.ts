import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "../types/generated/ts/db/schema.generated";

type SeededFlowRow = {
	id: string;
	data: {
		id: string;
	};
	createdAt: string;
	updatedAt: string;
};

type SeededDataRow = {
	id: string;
	namespace: string;
	resource: string;
	data: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
};

const insertedRows = {
	flows: [] as SeededFlowRow[],
	data: [] as SeededDataRow[],
};

const testDb = {
	delete(table: unknown) {
		if (table === schema.flow) {
			insertedRows.flows = [];
			return Promise.resolve();
		}
		if (table === schema.data) {
			insertedRows.data = [];
			return Promise.resolve();
		}
		throw new Error("Unexpected table deletion");
	},
	insert(table: unknown) {
		return {
			values: async (values: unknown) => {
				const rows = Array.isArray(values) ? values : [values];
				if (table === schema.flow) {
					insertedRows.flows.push(...(rows as SeededFlowRow[]));
					return;
				}
				if (table === schema.data) {
					insertedRows.data.push(...(rows as SeededDataRow[]));
					return;
				}
				throw new Error("Unexpected table insertion");
			},
		};
	},
};

mock.module("../api/src/db", () => ({
	db: testDb,
	schema,
}));

const { loadSeedInputs, seedDatabase } = await import("./seed");

async function clearTables() {
	insertedRows.flows = [];
	insertedRows.data = [];
}

async function createTempSeedFiles({
	evyFlows,
	serviceFlows,
	data,
}: {
	evyFlows: unknown;
	serviceFlows: unknown;
	data: unknown;
}) {
	const tempDir = await mkdtemp(join(tmpdir(), "evy-seed-"));
	const evyFlowsPath = join(tempDir, "evy_sdui.json");
	const serviceFlowsPath = join(tempDir, "service_sdui.json");
	const dataPath = join(tempDir, "service_data.json");

	await writeFile(evyFlowsPath, JSON.stringify(evyFlows));
	await writeFile(serviceFlowsPath, JSON.stringify(serviceFlows));
	await writeFile(dataPath, JSON.stringify(data));

	return {
		evyFlowsPath,
		serviceFlowsPath,
		dataPath,
		cleanup: async () => {
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}

beforeEach(async () => {
	await clearTables();
});

describe("seed script", () => {
	it("preserves JSON-defined ids for all seeded flows and data rows", async () => {
		const { flowsJson, dataJson } = await loadSeedInputs();

		await seedDatabase({
			flowsJson,
			dataJson,
			now: "2026-03-11T00:00:00.000Z",
		});

		expect(insertedRows.flows.length).toBeGreaterThan(0);
		for (const flow of insertedRows.flows) {
			expect(flow.id).toBe(flow.data.id);
		}

		expect(insertedRows.data.length).toBeGreaterThan(0);
		for (const row of insertedRows.data) {
			expect(typeof row.data).toBe("object");
			expect(row.data).not.toBeNull();

			const rowData = row.data as Record<string, unknown>;
			expect(typeof rowData.id).toBe("string");
			expect(row.id).toBe(rowData.id);
		}
	});

	it("rejects seeded data objects without a UUID id", async () => {
		const files = await createTempSeedFiles({
			evyFlows: [
				{
					id: "f267c629-2594-4770-8cec-d5324ebb4058",
					name: "Home",
					pages: [],
				},
			],
			serviceFlows: [],
			data: {
				conditions: [{ value: "New" }],
			},
		});

		try {
			await expect(
				loadSeedInputs({
					evyFlowsPath: files.evyFlowsPath,
					serviceFlowsPath: files.serviceFlowsPath,
					dataPath: files.dataPath,
				}),
			).rejects.toThrow(
				'Seed data validation failed for resource "conditions" at index 0',
			);
		} finally {
			await files.cleanup();
		}
	});

	it("rejects seeded SDUI flows without a UUID id", async () => {
		const files = await createTempSeedFiles({
			evyFlows: [
				{
					name: "Home",
					pages: [],
				},
			],
			serviceFlows: [],
			data: {
				conditions: [
					{
						id: "68e52916-7a07-4a07-ae0c-52e7800b9b9f",
						value: "For parts",
					},
				],
			},
		});

		try {
			await expect(
				loadSeedInputs({
					evyFlowsPath: files.evyFlowsPath,
					serviceFlowsPath: files.serviceFlowsPath,
					dataPath: files.dataPath,
				}),
			).rejects.toThrow("Flow validation failed");
		} finally {
			await files.cleanup();
		}
	});
});
