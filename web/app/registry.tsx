"use client";

import {
	ReactNode,
	Dispatch,
	useReducer,
	createContext,
	createElement,
} from "react";

import InfoRow from "./rows/view/InfoRow.tsx";
import InputListRow from "./rows/view/InputListRow.tsx";
import TextRow from "./rows/view/TextRow.tsx";
import ButtonRow from "./rows/action/ButtonRow.tsx";
import TextActionRow from "./rows/action/TextActionRow.tsx";
import CalendarRow from "./rows/edit/CalendarRow.tsx";
import DropdownRow from "./rows/edit/DropdownRow.tsx";
import InlinePickerRow from "./rows/edit/InlinePickerRow.tsx";
import InputRow from "./rows/edit/InputRow.tsx";
import SearchRow from "./rows/edit/SearchRow.tsx";
import SelectPhotoRow from "./rows/edit/SelectPhotoRow.tsx";
import TextAreaRow from "./rows/edit/TextAreaRow.tsx";
import TextSelectRow from "./rows/edit/TextSelectRow.tsx";
import { RowConfig } from "./rows/EVYRow.tsx";

export type RowBaseData = React.ComponentType<any> & { config: RowConfig };

export type RowData = {
	rowId: string;
	row: React.ReactNode;
	config: RowConfig;
};

export const baseRows: RowBaseData[] = [
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

type PagesState = {
	pageId: string;
	rowsData: RowData[];
}[];
type PagesAction =
	| {
			type: "ADD_ROW_TO_PAGE";
			pageId: string;
			rowId: string;
			rowIndexInBase: number;
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
			pageId: string;
			rowId: string;
			configId: string;
			configValue: string;
	  };
const pagesReducer = (state: PagesState, action: PagesAction): PagesState => {
	switch (action.type) {
		case "ADD_ROW_TO_PAGE":
			const pageIndexToAdd = state.findIndex(
				(page) => page.pageId === action.pageId
			);
			const baseRow = baseRows[action.rowIndexInBase];

			const rowDataAdd: RowData = {
				...baseRow,
				rowId: action.rowId,
				config: baseRow.config,
				row: createElement(baseRow, { rowId: action.rowId }),
			};

			const newRowsDataAdd = [
				...state[pageIndexToAdd].rowsData.slice(
					0,
					action.rowIndexInFinishPage
				),
				rowDataAdd,
				...state[pageIndexToAdd].rowsData.slice(
					action.rowIndexInFinishPage
				),
			];

			return state.map((page, idx) =>
				idx === pageIndexToAdd
					? { ...page, rowsData: newRowsDataAdd }
					: page
			);
		case "MOVE_ROW_ON_PAGE":
			const pageIndexMove = state.findIndex(
				(page) => page.pageId === action.startPageId
			);
			const newRowsData = [...state[pageIndexMove].rowsData];
			const [movedItem] = newRowsData.splice(
				action.rowIndexInStartPage,
				1
			);
			newRowsData.splice(action.rowIndexInFinishPage, 0, movedItem);

			return state.map((page, idx) =>
				idx === pageIndexMove
					? { ...page, rowsData: newRowsData }
					: page
			);
		case "MOVE_ROW_TO_PAGE":
			const sourcePageIndex = state.findIndex(
				(page) => page.pageId === action.startPageId
			);
			const destinationPageIndex = state.findIndex(
				(page) => page.pageId === action.finishPageId
			);
			const rowData =
				state[sourcePageIndex].rowsData[action.rowIndexInStartPage];

			const destinationItems = [...state[destinationPageIndex].rowsData];
			const newIndexInDestination = action.rowIndexInFinishPage;
			destinationItems.splice(newIndexInDestination, 0, rowData);

			return state.map((page, idx) => {
				if (idx === sourcePageIndex) {
					return {
						...page,
						rowsData: page.rowsData.filter(
							(_, i) => i !== action.rowIndexInStartPage
						),
					};
				}
				if (idx === destinationPageIndex) {
					return {
						...page,
						rowsData: destinationItems,
					};
				}
				return page;
			});
		case "REMOVE_ROW_FROM_PAGE":
			const pageIndex = state.findIndex(
				(page) => page.pageId === action.pageId
			);
			const newRowsDataRemoved = state[pageIndex].rowsData.filter(
				(_, idx) => idx !== action.rowIndex
			);
			return state.map((page, idx) =>
				idx === pageIndex
					? { ...page, rowsData: newRowsDataRemoved }
					: page
			);
		case "UPDATE_ROW_CONTENT":
			const pageIndexUpdate = state.findIndex(
				(page) => page.pageId === action.pageId
			);
			const relevantRow = state[pageIndexUpdate].rowsData.find(
				(row) => row.rowId === action.rowId
			);
			if (!relevantRow) return state;

			const newConfig = relevantRow?.config.map((config) =>
				config.id === action.configId
					? { ...config, value: action.configValue }
					: config
			);
			const newRowsDataUpdated = state[pageIndexUpdate].rowsData.map(
				(row) =>
					row.rowId === action.rowId
						? { ...row, config: newConfig }
						: row
			);
			return state.map((page, idx) =>
				idx === pageIndexUpdate
					? { ...page, rowsData: newRowsDataUpdated }
					: page
			);
		default:
			return state;
	}
};

type ActiveRowState =
	| {
			pageId: string;
			rowId: string;
	  }
	| undefined;
type ActiveRowAction =
	| {
			type: "ACTIVATE_ROW";
			pageId: string;
			rowId: string;
	  }
	| {
			type: "DEACTIVATE_ROW";
	  };
const activeRowReducer = (
	state: ActiveRowState,
	action: ActiveRowAction
): ActiveRowState => {
	switch (action.type) {
		case "ACTIVATE_ROW":
			return {
				pageId: action.pageId,
				rowId: action.rowId,
			};
		case "DEACTIVATE_ROW":
			return undefined;
		default:
			return state;
	}
};

export const AppContext = createContext<{
	pages: PagesState;
	activeRow: ActiveRowState;
	dispatchPages: Dispatch<PagesAction>;
	dispatchActiveRow: Dispatch<ActiveRowAction>;
}>({
	pages: [],
	activeRow: undefined,
	dispatchPages: () => {},
	dispatchActiveRow: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
	const [pages, dispatchPages] = useReducer(pagesReducer, [
		{
			pageId: "Step 1",
			rowsData: [],
		},
		{
			pageId: "Step 2",
			rowsData: [],
		},
	]);
	const [activeRow, dispatchActiveRow] = useReducer(
		activeRowReducer,
		undefined
	);

	return (
		<AppContext.Provider
			value={{ pages, activeRow, dispatchPages, dispatchActiveRow }}
		>
			{children}
		</AppContext.Provider>
	);
}
