import { createContext, useContext } from "react";
import type { Dispatch } from "react";

import type { Row } from "../../types/row";
import type { SDUI_Flow } from "../../types/flow";
import type { RowAction } from "../../types/actions";

export type FlowsContextValue = {
	rows: Row[];
	flows: SDUI_Flow[];
	activeFlowId?: string;
	activeRowId?: string;
	activePageId?: string;
	focusMode: boolean;
	secondarySheetRowId?: string;
	configStack: string[];
	dispatchRow: Dispatch<RowAction>;
};

export const FlowsContext = createContext<FlowsContextValue>({
	rows: [],
	flows: [],
	focusMode: false,
	configStack: [],
	dispatchRow: () => {},
});

export function useFlowsContext(): FlowsContextValue {
	return useContext(FlowsContext);
}
