import { createContext, type Dispatch, useContext } from "react";

import type {
	DraggingAction,
	DraggingState,
	DropIndicatorAction,
	DropIndicatorState,
} from "../../types/actions";

type DragContextValue = {
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
