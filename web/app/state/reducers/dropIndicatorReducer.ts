import type {
	DropIndicatorState,
	DropIndicatorAction,
} from "../../types/actions";

export const dropIndicatorReducer = (
	state: DropIndicatorState,
	action: DropIndicatorAction,
): DropIndicatorState => {
	switch (action.type) {
		case "SET_INDICATOR_ROW":
			return {
				...state,
				rowId: action.rowId,
				edge: action.edge,
			};
		case "UNSET_INDICATOR_ROW":
			return {
				...state,
				rowId: undefined,
				edge: undefined,
			};
		case "SET_INDICATOR_PAGE":
			return {
				...state,
				pageId: action.pageId,
			};
		case "UNSET_INDICATOR_PAGE":
			return {
				...state,
				pageId: undefined,
			};
		default:
			return state;
	}
};
