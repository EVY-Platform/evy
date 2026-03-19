import { createContext, type Dispatch } from "react";

import type { Row } from "../types/row";
import type { SDUI_Flow } from "../types/flow";
import type {
	DraggingState,
	DropIndicatorState,
	RowAction,
	DraggingAction,
	DropIndicatorAction,
} from "../types/actions";

export const AppContext = createContext<{
	rows: Row[];
	flows: SDUI_Flow[];
	activeFlowId?: string;
	activeRowId?: string;
	activePageId?: string;
	focusMode: boolean;
	secondarySheetRowId?: string;
	dragging: DraggingState;
	dropIndicator: DropIndicatorState;
	dispatchRow: Dispatch<RowAction>;
	dispatchDragging: Dispatch<DraggingAction>;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
}>({
	rows: [],
	flows: [],
	focusMode: false,
	dragging: false,
	dropIndicator: null,
	dispatchRow: () => {},
	dispatchDragging: () => {},
	dispatchDropIndicator: () => {},
});
