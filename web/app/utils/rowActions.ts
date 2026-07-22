import type { UI_RowAction, UI_RowActions } from "evy-types";

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
	if (Array.isArray(record.tap)) {
		normalized.tap = record.tap as UI_RowAction[];
	}
	if (Array.isArray(record.delete)) {
		normalized.delete = record.delete as UI_RowAction[];
	}
	return normalized;
}

export function compactRowActions(actions: UI_RowActions): UI_RowActions {
	const compact: UI_RowActions = {};
	if (actions.tap && actions.tap.length > 0) {
		compact.tap = actions.tap;
	}
	if (actions.delete && actions.delete.length > 0) {
		compact.delete = actions.delete;
	}
	return compact;
}

export function allRowActions(actions: UI_RowActions): UI_RowAction[] {
	const lists: UI_RowAction[] = [];
	if (actions.tap) {
		lists.push(...actions.tap);
	}
	if (actions.delete) {
		lists.push(...actions.delete);
	}
	return lists;
}
