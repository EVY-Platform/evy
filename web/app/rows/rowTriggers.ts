import {
	type RowTriggerName,
	type RowTriggerSpec,
	SDUI_ROW_TRIGGERS,
} from "evy-types";

export function getRowTriggers(type: string): RowTriggerSpec[] {
	return SDUI_ROW_TRIGGERS[type] ?? [];
}

export const TRIGGER_LABELS: Record<RowTriggerName, string> = {
	tap: "Tap",
	delete: "Delete",
	tap_row: "Tap row",
	tap_column: "Tap column",
	swipe_left: "Swipe left",
	submit: "Submit",
};
