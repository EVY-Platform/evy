/**
 * Row types. Serial row shapes come from evy-types (schema-generated).
 * RowConfig is the serial row shape without id, with recursive child rows using the UI Row type.
 * Row is the UI type (id + ReactNode + config).
 */

import type {
	RowSpecificAttributes as GeneratedRowSpecificAttributes,
	UI_Row as SerialRow,
	UI_RowActions,
} from "evy-types";
import type React from "react";

export type Row = {
	id: string;
	row: React.ReactNode;
	config: RowConfig;
};

// Row-specific attributes: the generated per-definition field union from
// evy-types, with child/children rows carrying the web UI Row type.
type RowSpecificAttributes = GeneratedRowSpecificAttributes<Row>;

type RowBaseAttributes = {
	type: SerialRow["type"];
	actions: UI_RowActions;
	visible: string;
	title: string;
	name?: string;
	source?: string;
	destination?: string;
	secondary?: string;
};

type RowAttributes = RowBaseAttributes &
	RowSpecificAttributes & {
		children_row_ids?: string[];
		sheet_row_id?: string;
		sheet?: Row;
	};

export type RowConfig = RowAttributes;

export type ContainerType = "children" | "sheet";
