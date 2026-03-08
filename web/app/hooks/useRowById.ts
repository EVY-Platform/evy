import { useContext, useMemo } from "react";

import { AppContext } from "../state";
import type { Row } from "../types/row";
import { getRowsRecursive } from "../utils/rowTree";

export function useRowById(rowId?: string): Row | undefined {
	const { rows, flows, activeFlowId } = useContext(AppContext);

	return useMemo(() => {
		if (!rowId) return undefined;

		const baseRow = rows.find((r) => r.id === rowId);
		if (baseRow) return baseRow;

		const pages = flows.find((f) => f.id === activeFlowId)?.pages ?? [];
		const allRows = pages.flatMap((page) => {
			const rows = page.rows.flatMap(getRowsRecursive);
			if (page.footer) rows.push(...getRowsRecursive(page.footer));
			return rows;
		});
		return allRows.find((r) => r.id === rowId);
	}, [rows, flows, activeFlowId, rowId]);
}
