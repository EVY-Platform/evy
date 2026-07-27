import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
} from "./generated/ts/data/data";

const ROW_CHILD_FIELD = "child_row_id";
const ROW_CHILDREN_FIELD = "children_row_ids";
const ROW_SHEET_FIELD = "sheet_row_id";

type EntityMap<T extends { id: string }> = Record<string, T>;

function getChildRowId(row: DATA_EVY_Row): string | undefined {
	const value = row.data[ROW_CHILD_FIELD];
	return typeof value === "string" ? value : undefined;
}

function getSheetRowId(row: DATA_EVY_Row): string | undefined {
	const value = row.data[ROW_SHEET_FIELD];
	return typeof value === "string" ? value : undefined;
}

function getChildrenRowIds(row: DATA_EVY_Row): string[] {
	const value = row.data[ROW_CHILDREN_FIELD];
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function pageRootIds(page: DATA_EVY_Page): string[] {
	return page.footerRowId
		? [...page.rowIds, page.footerRowId]
		: [...page.rowIds];
}

function walkRows(
	rowsById: EntityMap<DATA_EVY_Row>,
	rootRowIds: string[],
	visit: (id: string, row: DATA_EVY_Row) => void,
): void {
	const stack = [...rootRowIds];
	const visited = new Set<string>();
	while (stack.length > 0) {
		const id = stack.pop();
		if (id === undefined || visited.has(id)) continue;
		visited.add(id);
		const row = rowsById[id];
		if (!row) continue;

		visit(id, row);

		const childId = getChildRowId(row);
		if (childId) stack.push(childId);
		const sheetId = getSheetRowId(row);
		if (sheetId) stack.push(sheetId);
		stack.push(...getChildrenRowIds(row));
	}
}

function forEachRowInFlow(
	flow: DATA_EVY_Flow,
	pagesById: EntityMap<DATA_EVY_Page>,
	rowsById: EntityMap<DATA_EVY_Row>,
	visit: (id: string, row: DATA_EVY_Row) => void,
): void {
	for (const pageId of flow.pageIds) {
		const page = pagesById[pageId];
		if (!page) continue;
		walkRows(rowsById, pageRootIds(page), visit);
	}
}

function submitCreateTarget(branch: unknown): string | null {
	if (!branch || typeof branch !== "object") return null;
	const invocation = branch as Record<string, unknown>;
	if (invocation.fn !== "create" || invocation.mode !== "submit") return null;

	const service =
		typeof invocation.service === "string" ? invocation.service : "";
	const resource =
		typeof invocation.resource === "string" ? invocation.resource : "";
	if (!service || !resource) return null;
	return `${service}/${resource}`;
}

function addSubmitTargetsFromRow(row: DATA_EVY_Row, into: Set<string>): void {
	const actions = row.data.actions;
	if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
		return;
	}
	for (const actionList of Object.values(actions)) {
		if (!Array.isArray(actionList)) continue;
		for (const action of actionList) {
			if (!action || typeof action !== "object") continue;
			const record = action as Record<string, unknown>;
			for (const branch of [record.true, record.false]) {
				const target = submitCreateTarget(branch);
				if (target) into.add(target);
			}
		}
	}
}

export function collectSubmitTargetsFromFlatFlow(
	flow: DATA_EVY_Flow,
	pagesById: EntityMap<DATA_EVY_Page>,
	rowsById: EntityMap<DATA_EVY_Row>,
): Set<string> {
	const targets = new Set<string>();
	forEachRowInFlow(flow, pagesById, rowsById, (_id, row) => {
		addSubmitTargetsFromRow(row, targets);
	});
	return targets;
}

export function assertFlatFlowSubmitsDeclaration(
	flow: DATA_EVY_Flow,
	targets: Set<string>,
): void {
	if (targets.size === 0) return;

	if (targets.size > 1) {
		throw new Error(
			`Flow validation failed: flow ${flow.id} submits more than one entity (${[
				...targets,
			]
				.sort()
				.join(", ")}); a flow may submit at most one`,
		);
	}

	const [target] = [...targets];
	if (!flow.submits) {
		throw new Error(
			`Flow validation failed: flow ${flow.id} has a create(...,submit) targeting ${target} but declares no "submits"`,
		);
	}

	const declared = `${flow.submits.service}/${flow.submits.resource}`;
	if (declared !== target) {
		throw new Error(
			`Flow validation failed: flow ${flow.id} declares submits ${declared} but its create(...,submit) targets ${target}`,
		);
	}
}

export function assertFlatFlowGraphSubmits(
	flows: DATA_EVY_Flow[],
	pagesById: EntityMap<DATA_EVY_Page>,
	rowsById: EntityMap<DATA_EVY_Row>,
): void {
	for (const flow of flows) {
		const targets = collectSubmitTargetsFromFlatFlow(
			flow,
			pagesById,
			rowsById,
		);
		assertFlatFlowSubmitsDeclaration(flow, targets);
	}
}
