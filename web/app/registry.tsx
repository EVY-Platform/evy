import {
	ReactNode,
	Dispatch,
	useReducer,
	createContext,
	createElement,
} from "react";

import InfoRow from "./rows/view/InfoRow";
import InputListRow from "./rows/view/InputListRow";
import TextRow from "./rows/view/TextRow";
import ButtonRow from "./rows/action/ButtonRow";
import TextActionRow from "./rows/action/TextActionRow";
import CalendarRow from "./rows/edit/CalendarRow";
import DropdownRow from "./rows/edit/DropdownRow";
import InlinePickerRow from "./rows/edit/InlinePickerRow";
import InputRow from "./rows/edit/InputRow";
import SearchRow from "./rows/edit/SearchRow";
import SelectPhotoRow from "./rows/edit/SelectPhotoRow";
import TextAreaRow from "./rows/edit/TextAreaRow";
import TextSelectRow from "./rows/edit/TextSelectRow";
import { type RowConfig } from "./rows/EVYRow";

type Row = {
	rowId: string;
	row: React.ReactNode;
	config: RowConfig;
};

type Page = {
	id: string;
	rowsData: Row[];
};

type Flow = {
	id: string;
	name: string;
	type: "read" | "write";
	data: string;
	pages: Page[];
};

type RowAction =
	| {
			type: "ADD_ROW_TO_PAGE";
			pageId: string;
			rowId: string;
			rowIdInBase: string;
			rowIndexInFinishPage: number;
	  }
	| {
			type: "MOVE_ROW_ON_PAGE";
			startPageId: string;
			finishPageId: string;
			rowIndexInStartPage: number;
			rowIndexInFinishPage: number;
	  }
	| {
			type: "MOVE_ROW_TO_PAGE";
			startPageId: string;
			finishPageId: string;
			rowIndexInStartPage: number;
			rowIndexInFinishPage: number;
	  }
	| {
			type: "REMOVE_ROW_FROM_PAGE";
			pageId: string;
			rowIndex: number;
	  }
	| {
			type: "UPDATE_ROW_CONTENT";
			rowId: string;
			configId: string;
			configValue: string;
	  }
	| {
			type: "SET_ACTIVE_ROW";
			pageId: string;
			rowId: string;
	  }
	| {
			type: "SET_ACTIVE_FLOW";
			flowId: string;
	  };

const baseRows = [
	InfoRow,
	TextRow,
	InputListRow,
	ButtonRow,
	TextActionRow,
	CalendarRow,
	DropdownRow,
	InlinePickerRow,
	InputRow,
	SearchRow,
	SelectPhotoRow,
	TextAreaRow,
	TextSelectRow,
];

type AppState = {
	flows: Flow[];
	activeRowId: string | null;
	activeFlowId: string | null;
};

const pageReducer = (state: AppState, action: RowAction): AppState => {
	const flowIndex = state.flows.findIndex(
		(flow) => flow.id === state.activeFlowId
	);
	if (flowIndex === -1) return state;

	const flow = state.flows[flowIndex];

	const updateState = ({
		updatedPages,
		activeRowId,
		activeFlowId,
	}: {
		updatedPages?: Page[];
		activeRowId?: string;
		activeFlowId?: string;
	}): AppState => {
		return {
			...state,
			activeFlowId: activeFlowId || state.activeFlowId,
			activeRowId: activeRowId || state.activeRowId,
			flows: updatedPages
				? state.flows.map((f, idx) =>
						idx === flowIndex ? { ...f, pages: updatedPages } : f
				  )
				: state.flows,
		};
	};

	switch (action.type) {
		case "ADD_ROW_TO_PAGE": {
			const pageIndex = flow.pages.findIndex(
				(page) => page.id === action.pageId
			);
			if (pageIndex === -1) return state;

			const baseRow = baseRows.find((row) => {
				if (!row || typeof row !== "function") return false;
				return (row as { name: string }).name === action.rowIdInBase;
			})!;

			const rowDataAdd: Row = {
				...baseRow,
				rowId: action.rowId,
				config: baseRow.config,
				row: createElement(baseRow, { rowId: action.rowId }),
			};

			const newPages = flow.pages.map((page, idx) =>
				idx === pageIndex
					? {
							...page,
							rowsData: [
								...page.rowsData.slice(
									0,
									action.rowIndexInFinishPage
								),
								rowDataAdd,
								...page.rowsData.slice(
									action.rowIndexInFinishPage
								),
							],
					  }
					: page
			);

			return updateState({
				updatedPages: newPages,
				activeRowId: action.rowId,
			});
		}
		case "MOVE_ROW_ON_PAGE": {
			let rowId: string | undefined;
			const newPages = flow.pages.map((page) => {
				if (page.id === action.startPageId) {
					const newRowsData = [...page.rowsData];
					const [movedItem] = newRowsData.splice(
						action.rowIndexInStartPage,
						1
					);
					newRowsData.splice(
						action.rowIndexInFinishPage,
						0,
						movedItem
					);
					rowId = movedItem.rowId;
					return { ...page, rowsData: newRowsData };
				}
				return page;
			});
			return updateState({
				updatedPages: newPages,
				activeRowId: rowId,
			});
		}
		case "MOVE_ROW_TO_PAGE": {
			const sourcePageIndex = flow.pages.findIndex(
				(page) => page.id === action.startPageId
			);
			const destinationPageIndex = flow.pages.findIndex(
				(page) => page.id === action.finishPageId
			);

			if (sourcePageIndex === -1 || destinationPageIndex === -1)
				return state;

			const rowData =
				flow.pages[sourcePageIndex].rowsData[
					action.rowIndexInStartPage
				];
			const rowId = rowData.rowId;

			const newPages = flow.pages.map((page, idx) => {
				if (idx === sourcePageIndex) {
					return {
						...page,
						rowsData: page.rowsData.filter(
							(_, i) => i !== action.rowIndexInStartPage
						),
					};
				}
				if (idx === destinationPageIndex) {
					const destinationItems = [...page.rowsData];
					destinationItems.splice(
						action.rowIndexInFinishPage,
						0,
						rowData
					);
					return { ...page, rowsData: destinationItems };
				}
				return page;
			});

			return updateState({
				updatedPages: newPages,
				activeRowId: rowId,
			});
		}
		case "REMOVE_ROW_FROM_PAGE": {
			const pageIndex = flow.pages.findIndex(
				(page) => page.id === action.pageId
			);
			if (pageIndex === -1) return state;

			const newPages = flow.pages.map((page, idx) =>
				idx === pageIndex
					? {
							...page,
							rowsData: page.rowsData.filter(
								(_, i) => i !== action.rowIndex
							),
					  }
					: page
			);
			return updateState({ updatedPages: newPages });
		}
		case "UPDATE_ROW_CONTENT": {
			const pageIndex = flow.pages.findIndex((page) =>
				page.rowsData.find((r) => r.rowId === action.rowId)
			);
			if (pageIndex === -1) return state;

			const newPages = flow.pages.map((page, idx) => {
				if (idx === pageIndex) {
					const newRowsData = page.rowsData.map((row) => {
						if (row.rowId === action.rowId) {
							return {
								...row,
								config: {
									...row.config,
									view: {
										...row.config.view,
										content: {
											...row.config.view.content,
											[action.configId]:
												action.configValue,
										},
									},
								},
							};
						}
						return row;
					});
					return { ...page, rowsData: newRowsData };
				}
				return page;
			});
			return updateState({ updatedPages: newPages });
		}
		case "SET_ACTIVE_ROW": {
			return updateState({ activeRowId: action.rowId });
		}
		case "SET_ACTIVE_FLOW": {
			return updateState({ activeFlowId: action.flowId });
		}
		default:
			return state;
	}
};

type DraggingState = boolean;
type DraggingAction = {
	type: "SET_DRAGGING";
	dragging: boolean;
};
const draggingReducer = (
	state: DraggingState,
	action: DraggingAction
): DraggingState => {
	switch (action.type) {
		case "SET_DRAGGING":
			return action.dragging;
		default:
			return state;
	}
};

export const AppContext = createContext<{
	rows: Row[];
	flows: Flow[];
	activeFlowId: string | null;
	activeRowId: string | null;
	dragging: DraggingState;
	dispatchRow: Dispatch<RowAction>;
	dispatchDragging: Dispatch<DraggingAction>;
}>({
	rows: [],
	flows: [],
	activeFlowId: null,
	activeRowId: null,
	dragging: false,
	dispatchRow: () => {},
	dispatchDragging: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
	const rows = baseRows.map((row) => ({
		rowId: row.name,
		row: createElement(row, { rowId: row.name }),
		config: row.config,
	}));

	const [appState, dispatchRow] = useReducer(pageReducer, {
		flows: [
			{
				id: "flow-1",
				name: "First flow!",
				type: "write",
				data: "",
				pages: [
					{
						id: "Step 1",
						rowsData: [],
					},
					{
						id: "Step 2",
						rowsData: [],
					},
				],
			},
			{
				id: "flow-2",
				name: "Second flow",
				type: "write",
				data: "",
				pages: [
					{
						id: "Step 1",
						rowsData: [],
					},
				],
			},
		],
		activeRowId: null,
		activeFlowId: "flow-1",
	});

	const [dragging, dispatchDragging] = useReducer(draggingReducer, false);

	return (
		<AppContext.Provider
			value={{
				rows,
				flows: appState.flows,
				activeFlowId: appState.activeFlowId,
				activeRowId: appState.activeRowId,
				dragging,
				dispatchRow,
				dispatchDragging,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}
