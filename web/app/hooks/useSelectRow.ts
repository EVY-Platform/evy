import { type Dispatch, useCallback } from "react";

import type { RowAction } from "../types/actions";

export function useSelectRow(pageId: string, dispatchRow: Dispatch<RowAction>) {
	return useCallback(
		(rowId: string) => dispatchRow({ type: "SET_ACTIVE_ROW", pageId, rowId }),
		[pageId, dispatchRow],
	);
}
