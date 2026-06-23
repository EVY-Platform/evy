import { createContext, type Dispatch, useContext } from "react";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../../api/sync";
import type { RowAction } from "../../types/actions";
import type { UI_Flow } from "../../types/flow";
import type { Row } from "../../types/row";

export type FlowsContextValue = {
	rows: Row[];
	flows: UI_Flow[];
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
	flows: [],
	serviceResources: [],
	resourceAttributeMetadata: [],
	resourceIdToEntityName: new Map(),
	configStack: [],
	dispatchRow: () => {},
});

export function useFlowsContext(): FlowsContextValue {
	return useContext(FlowsContext);
}
