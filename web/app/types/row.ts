/**
 * Row types. Serial row shapes come from evy-types (schema-generated).
 * RowConfig is the serial row shape without id, with recursive child rows using the UI Row type.
 * Row is the UI type (id + ReactNode + config).
 */

import type { UI_Row as SerialRow, UI_RowAction } from "evy-types";
import type React from "react";

export type Row = {
	id: string;
	row: React.ReactNode;
	config: RowConfig;
};

// Keep in sync with SDUI_ROW_FIELDS (generated from types/schema/sdui/definitions/*.schema.json).
// This TS union must remain a superset of those schema-defined fields for static typing.
// The canonical per-type field list is now SDUI_ROW_FIELDS from evy-types; row.ts is the
// static type declaration layer.
type RowSpecificAttributes = {
	action?: string;
	child?: Row;
	children?: Row[];
	content?: string;
	end_time?: string;
	expandLabel?: string;
	format?: string;
	header_format?: string;
	header_subtitle?: string;
	icon?: string;
	image?: string;
	label?: string;
	label_interval_minutes?: string;
	placeholder?: string;
	segments?: string[];
	start_time?: string;
	subtitle?: string;
	text?: string;
	timeslot_format?: string;
	timeslot_interval_minutes?: string;
	value?: string;
};

type RowBaseAttributes = {
	type: SerialRow["type"];
	actions: UI_RowAction[];
	visible: string;
	title: string;
	name?: string;
	source?: string;
	destination?: string;
	secondary?: string;
};

type RowAttributes = RowBaseAttributes &
	RowSpecificAttributes & {
		childrenRowIds?: string[];
		childRowId?: string;
	};

export type RowConfig = RowAttributes;

export type ContainerType = "child" | "children";
