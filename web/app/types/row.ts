/**
 * Row types. All serial shapes come from evy-types (schema-generated).
 * RowContent/RowView/RowConfig are derived with UI Row in place of serial Row.
 * Row is the UI type (id + ReactNode + config).
 */
import type React from "react";
import type {
	SDUI_Row as SerialRow,
	SDUI_RowContent as SerialRowContent,
} from "evy-types/sdui/evy";

export type Row = {
	id: string;
	row: React.ReactNode;
	config: RowConfig;
};

/** Same shape as evy-types RowContent but children/child use UI Row */
export type RowContent = Omit<SerialRowContent, "children" | "child"> & {
	children?: Row[];
	child?: Row;
};

/** Same shape as serial Row.view but content uses UI RowContent */
export type RowView = Omit<SerialRow["view"], "content"> & {
	content: RowContent;
};

/** Same shape as evy-types Row minus id; view uses RowView (UI content) */
export type RowConfig = Omit<SerialRow, "id" | "view"> & { view: RowView };

export type ContainerType = "child" | "children";
