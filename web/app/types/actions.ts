import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_RowActions,
} from "evy-types";
import type { ContainerType } from "./row";

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
			type: "ADD_ROW_AS_FOOTER";
			newRowId: string;
			oldRowId: string;
			destinationPageId: string;
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
			type: "MOVE_ROW_TO_FOOTER";
			rowId: string;
			originPageId: string;
			destinationPageId: string;
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
			type: "UPDATE_ROW_ROOT";
			rowId: string;
			field: "source" | "destination" | "secondary" | "visible";
			value: string;
	  }
	| {
			type: "UPDATE_ROW_ACTIONS";
			rowId: string;
			actions: UI_RowActions;
	  }
	| {
			type: "SET_ACTIVE_FLOW";
			flowId: string;
	  }
	| {
			type: "CREATE_FLOW";
			name: string;
			submits?: { resource: string };
	  }
	| { type: "ADD_PAGE" }
	| { type: "REMOVE_PAGE"; pageId: string }
	| {
			type: "SET_ACTIVE_ROW";
			rowId: string;
			/** When set (e.g. browser URL restore), uses this stack instead of deriving from the canvas path */
			configStack?: string[];
	  }
	| {
			type: "SET_ACTIVE_PAGE";
			pageId: string;
	  }
	| {
			type: "CLEAR_ACTIVE_SELECTION";
	  }
	| {
			type: "UPDATE_PAGE_TITLE";
			pageId: string;
			title: string;
	  }
	| {
			type: "APPLY_REMOTE_RECORD";
			resource: string;
			record: { id: string; updated_at?: string; deleted_at?: string };
			operation: "create" | "update" | "delete";
	  }
	| {
			type: "UPDATE_FLOW_SETTINGS";
			flowId: string;
			name: string;
			submits: { resource: string } | undefined;
	  }
	| {
			type: "PUSH_CONFIG_STACK";
			parentRowId: string;
			childRowId: string;
	  }
	| { type: "NAVIGATE_BREADCRUMB"; configStackLength: number };

type DraggingSource = "rows" | "page";

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
	pageDropPosition?: "start" | "end";
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
	  }
	| {
			type: "SET_INDICATOR_PAGE_POSITION";
			pageId: string;
			position: "start" | "end";
	  }
	| {
			type: "UNSET_INDICATOR_PAGE_POSITION";
	  };

export type AppState = {
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	rowsById: Record<string, DATA_EVY_Row>;
	activeRowId?: string;
	activeFlowId?: string;
	activePageId?: string;
	configStack: string[];
};
