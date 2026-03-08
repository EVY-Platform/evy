import type { DraggingState, DraggingAction } from "../../types/actions";

export const draggingReducer = (
	state: DraggingState,
	action: DraggingAction,
): DraggingState => {
	switch (action.type) {
		case "START_DRAGGING":
			return action.source;
		case "STOP_DRAGGING":
			return false;
		default:
			return state;
	}
};
