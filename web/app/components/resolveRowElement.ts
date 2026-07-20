/**
 * Resolve the React element for a rowId from the flat store, cloning
 * the matching palette element (same approach as useRowById) so this
 * stays independent of the baseRows module graph.
 */
import type { DATA_EVY_Row } from "evy-types";
import {
	cloneElement,
	createElement,
	isValidElement,
	type ReactNode,
} from "react";
import { UnknownRow } from "../rows/EVYRow";
import type { Row } from "../types/row";

export function resolveRowElement(
	rowId: string,
	rowsById: Record<string, DATA_EVY_Row>,
	paletteRows: Row[],
): ReactNode {
	const record = rowsById[rowId];
	if (!record) {
		return paletteRows.find((r) => r.id === rowId)?.row;
	}
	const paletteMatch = paletteRows.find((r) => r.config.type === record.type);
	if (paletteMatch && isValidElement(paletteMatch.row)) {
		return cloneElement(paletteMatch.row, {
			key: rowId,
			rowId,
		} as Record<string, unknown>);
	}
	return createElement(UnknownRow, { key: rowId, rowId });
}
