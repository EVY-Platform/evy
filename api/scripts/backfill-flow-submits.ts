import { SQL } from "bun";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { flow, page, row } from "evy-types/db/schema.generated";
import { getPostgresConnectionUrl } from "evy-types/env";
import {
	collectSubmitTargetsFromFlatFlow,
	resolveSubmitsForFlatFlow,
} from "evy-types/flowSubmits";

const connection = new SQL(getPostgresConnectionUrl("DB_EVY_DATABASE"));
const db = drizzle({ client: connection });

function entitiesById<T extends { id: string }>(
	records: readonly T[],
): Record<string, T> {
	return Object.fromEntries(records.map((record) => [record.id, record]));
}

async function loadLiveFlows(): Promise<DATA_EVY_Flow[]> {
	const rows = await db.select().from(flow).where(isNull(flow.deletedAt));
	return rows as DATA_EVY_Flow[];
}

async function loadLivePages(): Promise<DATA_EVY_Page[]> {
	const rows = await db.select().from(page).where(isNull(page.deletedAt));
	return rows as DATA_EVY_Page[];
}

async function loadLiveRows(): Promise<DATA_EVY_Row[]> {
	const rows = await db.select().from(row).where(isNull(row.deletedAt));
	return rows as DATA_EVY_Row[];
}

async function backfillFlowSubmits(): Promise<void> {
	const [flows, pages, rows] = await Promise.all([
		loadLiveFlows(),
		loadLivePages(),
		loadLiveRows(),
	]);
	const pagesById = entitiesById(pages);
	const rowsById = entitiesById(rows);
	const nowIso = new Date().toISOString();

	for (const flowRecord of flows) {
		const targets = collectSubmitTargetsFromFlatFlow(
			flowRecord,
			pagesById,
			rowsById,
		);
		const resolvedSubmits = resolveSubmitsForFlatFlow(flowRecord, targets);
		const currentSubmits = flowRecord.submits ?? null;
		const nextSubmits = resolvedSubmits ?? null;

		if (
			currentSubmits?.service === nextSubmits?.service &&
			currentSubmits?.resource === nextSubmits?.resource
		) {
			continue;
		}

		if (nextSubmits === null) {
			continue;
		}

		await db
			.update(flow)
			.set({
				submits: nextSubmits,
				updatedAt: nowIso,
			})
			.where(eq(flow.id, flowRecord.id));

		console.log(
			`backfilled submits for flow ${flowRecord.id}: ${nextSubmits.service}/${nextSubmits.resource}`,
		);
	}
}

if (import.meta.main) {
	await backfillFlowSubmits();
	await connection.close();
}
