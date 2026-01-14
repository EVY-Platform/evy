import { createContext, type Dispatch } from "react";

import type {
	Row,
	Flow,
	DraggingState,
	DropIndicatorState,
	RowAction,
	DraggingAction,
	DropIndicatorAction,
} from "../types";

export const AppContext = createContext<{
	rows: Row[];
	flows: Flow[];
	activeFlowId?: string;
	activeRowId?: string;
	dragging: DraggingState;
	dropIndicator: DropIndicatorState;
	dispatchRow: Dispatch<RowAction>;
	dispatchDragging: Dispatch<DraggingAction>;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
}>({
	rows: [],
	flows: [],
	dragging: false,
	dropIndicator: null,
	dispatchRow: () => {},
	dispatchDragging: () => {},
	dispatchDropIndicator: () => {},
});
