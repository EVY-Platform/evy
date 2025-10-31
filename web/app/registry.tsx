import {
	ReactNode,
	Dispatch,
	useReducer,
	createContext,
	createElement,
} from "react";

import ButtonRow from "./rows/action/ButtonRow";
import CalendarRow from "./rows/edit/CalendarRow";
import ColumnContainerRow from "./rows/container/ColumnContainerRow";
import DropdownRow from "./rows/edit/DropdownRow";
import InfoRow from "./rows/view/InfoRow";
import InlinePickerRow from "./rows/edit/InlinePickerRow";
import InputListRow from "./rows/view/InputListRow";
import InputRow from "./rows/edit/InputRow";
import ListContainerRow from "./rows/container/ListContainerRow";
import SearchRow from "./rows/edit/SearchRow";
import SelectPhotoRow from "./rows/edit/SelectPhotoRow";
import SelectSegmentContainerRow from "./rows/container/SelectSegmentContainerRow";
import SheetContainerRow from "./rows/container/SheetContainerRow";
import TextActionRow from "./rows/action/TextActionRow";
import TextAreaRow from "./rows/edit/TextAreaRow";
import TextRow from "./rows/view/TextRow";
import TextSelectRow from "./rows/edit/TextSelectRow";

import {
	type RowConfig,
	type Row,
	type RowView,
	UnknownRow,
} from "./rows/EVYRow";
import { removeUndefined } from "./removeUndefined";

type Page = {
	id: string;
	title: string;
	rows: Row[];
	footer?: Row;
};

type Flow = {
	id: string;
	name: string;
	type: "read" | "write";
	data: string;
	pages: Page[];
};

// Server types necessary to ingest the raw flows
// since in client-side type we need to have the concrete
// row instances
type ServerRowContent = {
	title?: string;
	children?: ServerRow[];
	child?: ServerRow;
	[key: string]: string | ServerRow[] | ServerRow | undefined;
};
type ServerRow = Omit<RowConfig, "view"> & {
	view: Omit<RowView, "content"> & {
		content: ServerRowContent;
	};
};
type ServerPage = Omit<Page, "rows" | "footer"> & {
	rows: ServerRow[];
	footer?: ServerRow;
};
type ServerFlow = Omit<Flow, "pages"> & {
	pages: ServerPage[];
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
	ButtonRow,
	CalendarRow,
	ColumnContainerRow,
	DropdownRow,
	InfoRow,
	InlinePickerRow,
	InputListRow,
	InputRow,
	ListContainerRow,
	SearchRow,
	SelectPhotoRow,
	SelectSegmentContainerRow,
	SheetContainerRow,
	TextActionRow,
	TextAreaRow,
	TextRow,
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
							rows: [
								...page.rows.slice(
									0,
									action.rowIndexInFinishPage
								),
								rowDataAdd,
								...page.rows.slice(action.rowIndexInFinishPage),
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
					const newRows = [...page.rows];
					const [movedItem] = newRows.splice(
						action.rowIndexInStartPage,
						1
					);
					newRows.splice(action.rowIndexInFinishPage, 0, movedItem);
					rowId = movedItem.rowId;
					return { ...page, rows: newRows };
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

			const row =
				flow.pages[sourcePageIndex].rows[action.rowIndexInStartPage];
			const rowId = row.rowId;

			const newPages = flow.pages.map((page, idx) => {
				if (idx === sourcePageIndex) {
					return {
						...page,
						rows: page.rows.filter(
							(_, i) => i !== action.rowIndexInStartPage
						),
					};
				}
				if (idx === destinationPageIndex) {
					const destinationItems = [...page.rows];
					destinationItems.splice(
						action.rowIndexInFinishPage,
						0,
						row
					);
					return { ...page, rows: destinationItems };
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
							rows: page.rows.filter(
								(_, i) => i !== action.rowIndex
							),
					  }
					: page
			);
			return updateState({ updatedPages: newPages });
		}
		case "UPDATE_ROW_CONTENT": {
			const pageIndex = flow.pages.findIndex((page) =>
				page.rows.find((r) => r.rowId === action.rowId)
			);
			if (pageIndex === -1) return state;

			const newPages = flow.pages.map((page, idx) => {
				if (idx === pageIndex) {
					const newRows = page.rows.map((row) => {
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
					return { ...page, rows: newRows };
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

function decodeRow(row: ServerRow): Row {
	const rowId = crypto.randomUUID();
	const rowType = baseRows.find(
		(baseRow) => row.type === baseRow.config.type
	);
	if (!rowType) {
		return {
			rowId,
			row: createElement(UnknownRow, { rowId }),
			config: UnknownRow.config,
		};
	} else {
		return {
			rowId,
			row: createElement(rowType, { rowId }),
			config: removeUndefined({
				...row,
				view: {
					...row.view,
					content: {
						...row.view.content,
						title:
							typeof row.view.content.title === "string"
								? row.view.content.title
								: "Invalid title",
						children: row.view.content.children?.map(
							(child: ServerRow) => decodeRow(child)
						),
						child: row.view.content.child
							? decodeRow(row.view.content.child)
							: undefined,
					},
				},
			}),
		};
	}
}

const decodeFlows = (flows: ServerFlow[]): Flow[] => {
	return flows.map((flow) => ({
		...flow,
		pages: flow.pages.map((page: ServerPage) => ({
			...page,
			rows: page.rows.map(decodeRow),
			footer: page.footer ? decodeRow(page.footer) : undefined,
		})),
	}));
};

export function AppProvider({ children }: { children: ReactNode }) {
	const rows = baseRows.map((row) => ({
		rowId: row.name,
		row: createElement(row, { rowId: row.name }),
		config: row.config,
	}));

	const flows: ServerFlow[] = [
		{
			id: "flow-1",
			name: "First flow!",
			type: "write",
			data: "",
			pages: [
				{
					id: "step_1",
					title: "Create listing",
					rows: [
						{
							type: "ColumnContainer",
							view: {
								content: {
									title: "Dimensions (width x height x depth)",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination:
													"{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination:
													"{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
						{
							type: "ListContainer",
							view: {
								content: {
									title: "Dimensions (width x height x depth)",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination:
													"{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination:
													"{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
					],
				},
				{
					id: "step_2",
					title: "Step 2",
					rows: [
						{
							type: "SelectSegmentContainer",
							view: {
								content: {
									title: "",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "Width",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination:
													"{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Height",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Length",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination:
													"{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
					],
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
					id: "step_2_1",
					title: "Step 1",
					rows: [],
				},
			],
		},
	];

	const [appState, dispatchRow] = useReducer(pageReducer, {
		flows: decodeFlows(flows),
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
