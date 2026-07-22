import {
	type RowTriggerName,
	type RowTriggerSpec,
	SDUI_ROW_TRIGGERS,
} from "evy-types";

export type { RowTriggerName };

export function getRowTriggers(type: string): RowTriggerSpec[] {
	return SDUI_ROW_TRIGGERS[type] ?? [];
}

export const TRIGGER_LABELS: Record<RowTriggerName, string> = {
	tap: "Tap",
	delete: "Delete",
	"tap-row": "Tap row",
	"tap-column": "Tap column",
	"slide-left": "Slide left",
};
