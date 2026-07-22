import type { RowTriggerName, UI_RowAction, UI_RowActions } from "evy-types";

const ROW_ACTION_TRIGGER_KEYS: RowTriggerName[] = [
	"tap",
	"delete",
	"tap-row",
	"tap-column",
];

export function rowAction(branch: string): UI_RowAction {
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
