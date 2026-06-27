import { cloneElement, isValidElement, useMemo } from "react";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import type { Row } from "../types/row";
import { buildRowConfigFromRecord } from "../utils/rowConfig";

export function useRowById(rowId?: string): Row | undefined {
	const { rows, rowsById } = useFlowsContext();

	return useMemo(() => {
		if (!rowId) return undefined;

		// Check palette rows first (template/base rows)
		const paletteRow = rows.find((r) => r.id === rowId);
		if (paletteRow) return paletteRow;

		// Resolve from flat store
		const record = rowsById[rowId];
		if (!record) return undefined;

		const config = buildRowConfigFromRecord(record);

		// Derive the React element from a matching palette row (avoids importing
		// baseRows/rowCodec which would create a circular dependency through defineRow).
		const paletteMatch = rows.find((r) => r.config.type === record.type);
		const rowElement = paletteMatch?.row;
		const row = isValidElement(rowElement)
			? cloneElement(rowElement, {
					key: record.id,
					rowId: record.id,
				} as Record<string, unknown>)
			: null;

		return { id: record.id, row, config };
	}, [rows, rowsById, rowId]);
}
