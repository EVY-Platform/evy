import { createContext, useContext, type Dispatch } from "react";

import type { Row } from "../../types/row";
import type { UI_Flow } from "../../types/flow";
import type { RowAction } from "../../types/actions";

export type FlowsContextValue = {
	rows: Row[];
	flows: UI_Flow[];
	activeFlowId?: string;
	activeRowId?: string;
	activePageId?: string;
	secondarySheetRowId?: string;
	configStack: string[];
	dispatchRow: Dispatch<RowAction>;
};

export const FlowsContext = createContext<FlowsContextValue>({
	rows: [],
	flows: [],
	configStack: [],
	dispatchRow: () => {},
});

export function useFlowsContext(): FlowsContextValue {
	return useContext(FlowsContext);
}
