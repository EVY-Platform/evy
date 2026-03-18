import type { ContainerType } from "./row";
import type { SDUI_Flow } from "./flow";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { SDUI_RowAction } from "evy-types";

export type RowAction =
	| {
			type: "ADD_ROW";
			newRowId: string;
			oldRowId: string;
			destinationPageId: string;
			destinationIndex: number;
			destinationContainer?: { rowId: string; type: ContainerType };
	  }
	| {
			type: "MOVE_ROW";
			rowId: string;
			originPageId: string;
			destinationPageId: string;
			destinationIndex: number;
			destinationContainer?: { rowId: string; type: ContainerType };
	  }
	| {
			type: "REMOVE_ROW";
			pageId: string;
			rowId: string;
	  }
	| {
			type: "UPDATE_ROW";
			rowId: string;
			configId: string;
			configValue: string;
	  }
	| {
			type: "UPDATE_ROW_ACTIONS";
			rowId: string;
			actions: SDUI_RowAction[];
	  }
	| {
			type: "SET_ACTIVE_FLOW";
			flowId: string;
	  }
	| {
			type: "SET_ACTIVE_ROW";
			pageId: string;
			rowId: string;
	  }
	| {
			type: "SET_ACTIVE_PAGE";
			pageId: string;
	  }
	| {
			type: "CLEAR_ACTIVE_SELECTION";
	  }
	| {
			type: "TOGGLE_FOCUS_MODE";
	  }
	| {
			type: "UPDATE_PAGE_TITLE";
			pageId: string;
			title: string;
	  }
	| { type: "OPEN_SECONDARY_SHEET"; sheetRowId: string }
	| { type: "CLOSE_SECONDARY_SHEET" };

export type DraggingSource = "rows" | "page";

export type DraggingState = false | DraggingSource;

export type DraggingAction =
	| {
			type: "START_DRAGGING";
			source: DraggingSource;
	  }
	| {
			type: "STOP_DRAGGING";
	  };

export type DropIndicatorState = {
	rowId?: string;
	pageId?: string;
	edge?: Edge;
} | null;

export type DropIndicatorAction =
	| {
			type: "SET_INDICATOR_ROW";
			rowId: string;
			edge: Edge;
	  }
	| {
			type: "UNSET_INDICATOR_ROW";
	  }
	| {
			type: "SET_INDICATOR_PAGE";
			pageId: string;
	  }
	| {
			type: "UNSET_INDICATOR_PAGE";
	  };

export type AppState = {
	flows: SDUI_Flow[];
	activeRowId?: string;
	activeFlowId?: string;
	activePageId?: string;
	focusMode: boolean;
	secondarySheetRowId?: string;
};
