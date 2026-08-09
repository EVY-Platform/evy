import { type ActionExpressionAst, parseActionExpression } from "./actionAst";
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
} from "./generated/ts/data/data";

const ROW_CHILDREN_FIELD = "children_row_ids";
const ROW_SHEET_FIELD = "sheet_row_id";

type EntityMap<T extends { id: string }> = Record<string, T>;

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
	return page.footer_row_id
		? [...page.row_ids, page.footer_row_id]
		: [...page.row_ids];
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
	for (const pageId of flow.page_ids) {
		const page = pagesById[pageId];
		if (!page) continue;
		walkRows(rowsById, pageRootIds(page), visit);
	}
}

export function forEachActionBranch(
	actions: unknown,
	visit: (branch: unknown, path: string) => void,
): void {
	if (!actions || typeof actions !== "object" || Array.isArray(actions)) {
		return;
	}
	for (const [trigger, list] of Object.entries(actions)) {
		if (!Array.isArray(list)) continue;
		for (let index = 0; index < list.length; index++) {
			const action = list[index];
			if (!action || typeof action !== "object") continue;
			const record = action as Record<string, unknown>;
			visit(record.true, `${trigger}/${index}/true`);
			visit(record.false, `${trigger}/${index}/false`);
		}
	}
}

export function submitCreateTargetFromAst(
	ast: ActionExpressionAst,
): string | null {
	if (ast.fn !== "create" || ast.mode !== "submit") return null;
	return ast.resource;
}

/** A submit-mode create -> resource ref, else null. */
export function submitCreateTarget(branch: unknown): string | null {
	if (typeof branch !== "string") return null;
	const trimmed = branch.trim();
	if (!trimmed) return null;
	const parsed = parseActionExpression(trimmed);
	if (!parsed.ok) return null;
	return submitCreateTargetFromAst(parsed.ast);
}

function addSubmitTargetsFromRow(row: DATA_EVY_Row, into: Set<string>): void {
	forEachActionBranch(row.data.actions, (branch) => {
		const target = submitCreateTarget(branch);
		if (target) into.add(target);
	});
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

	const declared = flow.submits.resource;
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
