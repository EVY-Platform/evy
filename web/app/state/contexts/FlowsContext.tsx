import { createContext, useContext, type Dispatch } from "react";

import type { Row } from "../../types/row";
import type { UI_Flow } from "../../types/flow";
import type { RowAction } from "../../types/actions";
import type { ServiceResource } from "../../api/sync";

export type FlowsContextValue = {
	rows: Row[];
	flows: UI_Flow[];
	serviceResources: ServiceResource[];
	activeFlowId?: string;
	activeRowId?: string;
	activePageId?: string;
	configStack: string[];
	dispatchRow: Dispatch<RowAction>;
};

export const FlowsContext = createContext<FlowsContextValue>({
	rows: [],
	flows: [],
	serviceResources: [],
	configStack: [],
	dispatchRow: () => {},
});

export function useFlowsContext(): FlowsContextValue {
	return useContext(FlowsContext);
}
