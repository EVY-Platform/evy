import {
	type RowTriggerName,
	type RowTriggerSpec,
	SDUI_ROW_TRIGGERS,
} from "evy-types";

export type { RowTriggerName, RowTriggerSpec };

export function getRowTriggers(type: string): RowTriggerSpec[] {
	return SDUI_ROW_TRIGGERS[type] ?? [];
}

export const TRIGGER_LABELS: Record<RowTriggerName, string> = {
	tap: "Tap",
	delete: "Delete",
};
