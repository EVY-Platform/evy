import type { ContainerType } from "./row";
import type { Flow } from "./flow";
import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

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
			type: "SET_ACTIVE_FLOW";
			flowId: string;
	  }
	| {
			type: "SET_ACTIVE_ROW";
			pageId: string;
			rowId: string;
	  };

export type DraggingState = boolean;

export type DraggingAction =
	| {
			type: "START_DRAGGING";
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
	flows: Flow[];
	activeRowId?: string;
	activeFlowId?: string;
};
