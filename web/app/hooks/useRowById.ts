import { useMemo } from "react";

import { useFlowsContext } from "../state";
import type { Row } from "../types/row";
import { findFlowById } from "../utils/flowHelpers";
import { getRowsRecursive } from "../utils/rowTree";

export function useRowById(rowId?: string): Row | undefined {
	const { rows, flows, activeFlowId } = useFlowsContext();

	return useMemo(() => {
		if (!rowId) return undefined;

		const baseRow = rows.find((r) => r.id === rowId);
		if (baseRow) return baseRow;

		const pages = findFlowById(flows, activeFlowId)?.pages ?? [];
		const allRows = pages.flatMap((page) => {
			const rows = page.rows.flatMap(getRowsRecursive);
			if (page.footer) rows.push(...getRowsRecursive(page.footer));
			return rows;
		});
		return allRows.find((r) => r.id === rowId);
	}, [rows, flows, activeFlowId, rowId]);
}
