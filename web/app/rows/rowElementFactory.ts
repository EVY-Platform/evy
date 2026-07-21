/**
 * The one place React elements are made for rows. Lives in rows/ so
 * utils stay pure record<->config transforms and components resolve
 * palette components through a single factory.
 */
import type { DATA_EVY_Row } from "evy-types";
import { createElement, type ReactNode } from "react";
import type { Row } from "../types/row";
import { buildRowConfigFromRecord } from "../utils/rowConfig";
import { baseRows } from "./baseRows";
import { UnknownRow } from "./EVYRow";

export type RowComponent = (typeof baseRows)[number];

const BASE_ROW_BY_TYPE = new Map<string, RowComponent>(
	baseRows.map((r) => [r.config.type, r]),
);

export function getBaseRowForType(type: string): RowComponent | undefined {
	return BASE_ROW_BY_TYPE.get(type);
}

export function createRowElement(type: string, rowId: string): ReactNode {
	return createElement(getBaseRowForType(type) ?? UnknownRow, {
		key: rowId,
		rowId,
	});
}

export function storedRowToRow(record: DATA_EVY_Row): Row {
	return {
		id: record.id,
		row: createRowElement(record.type, record.id),
		config: buildRowConfigFromRecord(record),
	};
}
