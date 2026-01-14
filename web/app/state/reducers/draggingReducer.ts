import type { DraggingState, DraggingAction } from "../../types";

export const draggingReducer = (
	state: DraggingState,
	action: DraggingAction
): DraggingState => {
	switch (action.type) {
		case "START_DRAGGING":
			return true;
		case "STOP_DRAGGING":
			return false;
		default:
			return state;
	}
};
