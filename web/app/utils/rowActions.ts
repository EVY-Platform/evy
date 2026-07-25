import type {
	RowTriggerName,
	UI_ActionBranch,
	UI_RowAction,
	UI_RowActions,
} from "evy-types";
import { TRIGGER_LABELS } from "../rows/rowTriggers";

const ROW_ACTION_TRIGGER_KEYS = Object.keys(TRIGGER_LABELS) as RowTriggerName[];

export function rowAction(branch: UI_ActionBranch): UI_RowAction {
	return { condition: "", false: "", true: branch };
}

export function normalizeStoredRowActions(actions: unknown): UI_RowActions {
	if (actions === undefined || actions === null) {
		return {};
	}
	if (Array.isArray(actions)) {
		throw new Error(
			"Row actions must be a trigger-keyed object, not an array",
		);
	}
	if (typeof actions !== "object") {
		return {};
	}
	const record = actions as Record<string, unknown>;
	const normalized: UI_RowActions = {};
	for (const key of ROW_ACTION_TRIGGER_KEYS) {
		if (Array.isArray(record[key])) {
			normalized[key] = record[key] as UI_RowAction[];
		}
	}
	return normalized;
}

export function compactRowActions(actions: UI_RowActions): UI_RowActions {
	const compact: UI_RowActions = {};
	for (const key of ROW_ACTION_TRIGGER_KEYS) {
		const list = actions[key];
		if (list && list.length > 0) {
			compact[key] = list;
		}
	}
	return compact;
}

export function allRowActions(actions: UI_RowActions): UI_RowAction[] {
	const lists: UI_RowAction[] = [];
	for (const key of ROW_ACTION_TRIGGER_KEYS) {
		const list = actions[key];
		if (list) {
			lists.push(...list);
		}
	}
	return lists;
}
