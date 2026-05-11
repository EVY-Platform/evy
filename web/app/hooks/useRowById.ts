import { useMemo } from "react";

import { useFlowsContext } from "../state/contexts/FlowsContext";
import type { Row } from "../types/row";
import { findFlowById } from "../utils/flowHelpers";
import { getRowsInPage } from "../utils/rowTree";

export function useRowById(rowId?: string): Row | undefined {
	const { rows, flows, activeFlowId } = useFlowsContext();

	return useMemo(() => {
		if (!rowId) return undefined;

		const baseRow = rows.find((r) => r.id === rowId);
		if (baseRow) return baseRow;

		const pages = findFlowById(flows, activeFlowId)?.pages ?? [];
		const allRows = pages.flatMap(getRowsInPage);
		return allRows.find((r) => r.id === rowId);
	}, [rows, flows, activeFlowId, rowId]);
}
