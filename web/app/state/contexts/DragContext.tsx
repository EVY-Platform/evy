import { createContext, useContext } from "react";
import type { Dispatch } from "react";

import type {
	DraggingState,
	DropIndicatorState,
	DraggingAction,
	DropIndicatorAction,
} from "../../types/actions";

export type DragContextValue = {
	dragging: DraggingState;
	dropIndicator: DropIndicatorState;
	dispatchDragging: Dispatch<DraggingAction>;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
};

export const DragContext = createContext<DragContextValue>({
	dragging: false,
	dropIndicator: null,
	dispatchDragging: () => {},
	dispatchDropIndicator: () => {},
});

export function useDragContext(): DragContextValue {
	return useContext(DragContext);
}
