/**
 * Row types. Serial row shapes come from evy-types (schema-generated).
 * RowConfig is the serial row shape without id, with recursive child rows using the UI Row type.
 * Row is the UI type (id + ReactNode + config).
 */

import type { UI_Row as SerialRow } from "evy-types";
import type React from "react";

export type Row = {
	id: string;
	row: React.ReactNode;
	config: RowConfig;
};

type RowAttributes = Omit<SerialRow, "id" | "child" | "children"> & {
	children?: Row[];
	child?: Row;
	childrenRowIds?: string[];
	childRowId?: string;
};

export type RowConfig = RowAttributes;

export type ContainerType = "child" | "children";
