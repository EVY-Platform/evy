import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_Flow as ServerFlow,
} from "evy-types";
import { decomposeServerFlow } from "./serverFlowDecompose";

type EntityMap<T extends { id: string }> = Record<string, T>;

export type FlowEntityCollections = {
	flows: DATA_EVY_Flow[];
	pages: DATA_EVY_Page[];
	rows: DATA_EVY_Row[];
};

export type FlowEntityMaps = {
	flowsById: EntityMap<DATA_EVY_Flow>;
	pagesById: EntityMap<DATA_EVY_Page>;
	rowsById: EntityMap<DATA_EVY_Row>;
};

function entitiesById<T extends { id: string }>(
	entities: readonly T[],
): EntityMap<T> {
	return Object.fromEntries(entities.map((entity) => [entity.id, entity]));
}

export function collectionsToMaps(
	collections: FlowEntityCollections,
): FlowEntityMaps {
	return {
		flowsById: entitiesById(collections.flows),
		pagesById: entitiesById(collections.pages),
		rowsById: entitiesById(collections.rows),
	};
}

/**
 * Converts nested ServerFlow[] (from test fixtures / __TEST_FLOWS__) to flat
 * FlowEntityCollections. Used only for test initialisation in App.tsx.
 */
export function serverFlowsToCollections(
	flows: readonly ServerFlow[],
	nowIso = new Date().toISOString(),
): FlowEntityCollections {
	const flowRows: DATA_EVY_Flow[] = [];
	const pageRows: DATA_EVY_Page[] = [];
	const rowRows: DATA_EVY_Row[] = [];

	for (const flow of flows) {
		const graph = decomposeServerFlow(flow, nowIso);
		flowRows.push(...graph.flowRows);
		pageRows.push(...graph.pageRows);
		rowRows.push(...graph.rowRows);
	}

	return { flows: flowRows, pages: pageRows, rows: rowRows };
}

export function collectSubtreeRowIds(
	rowId: string,
	rowsById: EntityMap<DATA_EVY_Row>,
	visited = new Set<string>(),
): Set<string> {
	if (visited.has(rowId)) return visited;
	const row = rowsById[rowId];
	if (!row) return visited;
	visited.add(rowId);

	const child_row_id = row.data.child_row_id;
	if (typeof child_row_id === "string") {
		collectSubtreeRowIds(child_row_id, rowsById, visited);
	}

	const sheet_row_id = row.data.sheet_row_id;
	if (typeof sheet_row_id === "string") {
		collectSubtreeRowIds(sheet_row_id, rowsById, visited);
	}

	const children_row_ids = row.data.children_row_ids;
	if (Array.isArray(children_row_ids)) {
		for (const childId of children_row_ids) {
			if (typeof childId === "string") {
				collectSubtreeRowIds(childId, rowsById, visited);
			}
		}
	}
	return visited;
}

export function collectReachableEntityIds(
	flowId: string | undefined,
	maps: FlowEntityMaps,
): { flowIds: Set<string>; pageIds: Set<string>; rowIds: Set<string> } {
	const flowIds = new Set<string>();
	const pageIds = new Set<string>();
	const rowIds = new Set<string>();
	if (!flowId) return { flowIds, pageIds, rowIds };

	const flow = maps.flowsById[flowId];
	if (!flow) return { flowIds, pageIds, rowIds };
	flowIds.add(flow.id);

	for (const pageId of flow.page_ids) {
		const page = maps.pagesById[pageId];
		if (!page) continue;
		pageIds.add(page.id);
		for (const rowId of page.row_ids) {
			collectSubtreeRowIds(rowId, maps.rowsById, rowIds);
		}
		if (page.footer_row_id) {
			collectSubtreeRowIds(page.footer_row_id, maps.rowsById, rowIds);
		}
	}

	return { flowIds, pageIds, rowIds };
}

export function scopeCollectionsToReachableIds(
	maps: FlowEntityMaps,
	reachableIds: {
		flowIds: Set<string>;
		pageIds: Set<string>;
		rowIds: Set<string>;
	},
): FlowEntityCollections {
	return {
		flows: [...reachableIds.flowIds]
			.map((id) => maps.flowsById[id])
			.filter((flow): flow is DATA_EVY_Flow => Boolean(flow)),
		pages: [...reachableIds.pageIds]
			.map((id) => maps.pagesById[id])
			.filter((page): page is DATA_EVY_Page => Boolean(page)),
		rows: [...reachableIds.rowIds]
			.map((id) => maps.rowsById[id])
			.filter((row): row is DATA_EVY_Row => Boolean(row)),
	};
}

export function collectionsEqual(
	previous: FlowEntityCollections,
	next: FlowEntityCollections,
): boolean {
	return (
		JSON.stringify(withoutTimestamps(previous)) ===
		JSON.stringify(withoutTimestamps(next))
	);
}

function withoutTimestamps(collections: FlowEntityCollections) {
	return {
		flows: collections.flows.map(
			({ created_at: _created_at, updated_at: _updated_at, ...flow }) =>
				flow,
		),
		pages: collections.pages.map(
			({ created_at: _created_at, updated_at: _updated_at, ...page }) =>
				page,
		),
		rows: collections.rows.map(
			({ created_at: _created_at, updated_at: _updated_at, ...row }) =>
				row,
		),
	};
}
