import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { createContext, type Dispatch, useContext } from "react";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../../api/sync";
import type { RowAction } from "../../types/actions";
import type { Row } from "../../types/row";

type FlowsContextValue = {
	rows: Row[];
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	rowsById: Record<string, DATA_EVY_Row>;
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
	resourceIdToEntityName: Map<string, string>;
	activeFlowId?: string;
	activeRowId?: string;
	activePageId?: string;
	configStack: string[];
	dispatchRow: Dispatch<RowAction>;
};

export const FlowsContext = createContext<FlowsContextValue>({
	rows: [],
	flowsById: {},
	pagesById: {},
	rowsById: {},
	serviceResources: [],
	resourceAttributeMetadata: [],
	resourceIdToEntityName: new Map(),
	configStack: [],
	dispatchRow: () => {},
});

export function useFlowsContext(): FlowsContextValue {
	return useContext(FlowsContext);
}
