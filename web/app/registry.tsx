import {
	ReactNode,
	Dispatch,
	useReducer,
	createContext,
	createElement,
} from "react";
import invariant from "tiny-invariant";

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

import { debugFlows } from "../tests/utils.tsx"; // Temporary as we build out EVY
import { Edge } from "./components/DraggableRowContainer";
import {
	type RowConfig,
	type Row,
	type RowView,
	UnknownRow,
	type ContainerType,
	EVYRow,
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
	title: string;
	children?: ServerRow[];
	child?: ServerRow;
	[key: string]: string | string[] | ServerRow[] | ServerRow | undefined;
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
export type ServerFlow = Omit<Flow, "pages"> & {
	pages: ServerPage[];
};

type RowAction =
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
	activeRowId?: string;
	activeFlowId?: string;
};

const pageReducer = (state: AppState, action: RowAction): AppState => {
	const flow = state.flows.find((f) => f.id === state.activeFlowId);
	if (!flow) return state;

	const updateState = ({
		updatedPages,
		activeFlowId,
		activeRowId,
	}: {
		updatedPages?: Page[];
		activeFlowId?: string;
		activeRowId?: string;
	}): AppState => {
		return {
			...state,
			...(updatedPages
				? {
						flows: state.flows.map((f) =>
							f.id === state.activeFlowId
								? { ...f, pages: updatedPages }
								: f
						),
				  }
				: {}),
			...(activeFlowId && activeFlowId !== state.activeFlowId
				? { activeFlowId }
				: {}),
			...(activeRowId && activeRowId !== state.activeRowId
				? { activeRowId }
				: {}),
		};
	};

	switch (action.type) {
		case "ADD_ROW": {
			const baseRow = baseRows.find((row) => {
				if (!row || typeof row !== "function") return false;
				return (row as { name: string }).name === action.oldRowId;
			})!;

			const rowDataAdd: Row = {
				...baseRow,
				rowId: action.newRowId,
				config: baseRow.config,
				row: createElement(baseRow, { rowId: action.newRowId }),
			};

			const page = flow.pages.find(
				(p) => p.id === action.destinationPageId
			)!;
			if (!page) throw new Error("Page not found");

			if (action.destinationContainer) {
				const stepsToDestinationContainer = page.rows
					.map((row, index) => {
						if (row.rowId === action.destinationContainer!.rowId) {
							return [index];
						}
						const match = EVYRow.traverseToRowAndGetPath(
							row,
							action.destinationContainer!.rowId
						);
						if (match.length > 0) return [index, ...match];
					})
					.find((s) => s !== undefined);

				if (!stepsToDestinationContainer?.length) {
					throw new Error(
						"Could not find steps to destination container"
					);
				}

				let path = page.rows[stepsToDestinationContainer[0] as number];
				if (stepsToDestinationContainer.length > 1) {
					path = stepsToDestinationContainer
						.slice(1)
						.reduce((acc: Row, curr: number | "child") => {
							if (curr === "child") {
								return acc.config.view.content.child!;
							} else {
								return acc.config.view.content.children![curr];
							}
						}, path);
				}

				if (action.destinationContainer?.type === "child") {
					path.config.view.content.child = rowDataAdd;
				} else if (action.destinationContainer?.type === "children") {
					path.config.view.content.children!.splice(
						action.destinationIndex,
						0,
						rowDataAdd
					);
				}
			} else {
				page.rows.splice(action.destinationIndex, 0, rowDataAdd);
			}

			return updateState({
				updatedPages: flow.pages,
				activeRowId: action.newRowId,
			});
		}
		case "MOVE_ROW": {
			const row = flow.pages
				.find((page) => page.id === action.originPageId)
				?.rows.find((r) => r.rowId === action.rowId);
			invariant(row);

			const newPages = flow.pages.map((page) => {
				if (
					page.id === action.originPageId &&
					page.id === action.destinationPageId
				) {
					const destinationItems = [
						...page.rows.filter((r) => r.rowId !== action.rowId),
					];
					destinationItems.splice(action.destinationIndex, 0, row);
					return {
						...page,
						rows: destinationItems,
					};
				}
				if (page.id === action.originPageId) {
					return {
						...page,
						rows: page.rows.filter((r) => r.rowId !== action.rowId),
					};
				}
				if (page.id === action.destinationPageId) {
					const destinationItems = [...page.rows];
					destinationItems.splice(action.destinationIndex, 0, row);
					return { ...page, rows: destinationItems };
				}
				return page;
			});

			return updateState({
				updatedPages: newPages,
				activeRowId: action.rowId,
			});
		}
		case "REMOVE_ROW": {
			const newPages = flow.pages.map((page) =>
				page.id === action.pageId
					? {
							...page,
							rows: page.rows.filter(
								(r) => r.rowId !== action.rowId
							),
					  }
					: page
			);
			return updateState({ updatedPages: newPages });
		}
		case "UPDATE_ROW": {
			const splitValue = action.configValue.split(",");

			const updateRowInChildren = (
				row: Row,
				targetRowId: string,
				configId: string,
				configValue: string
			): Row | null => {
				if (row.rowId === targetRowId) {
					return {
						...row,
						config: {
							...row.config,
							view: {
								...row.config.view,
								content: {
									...row.config.view.content,
									[configId]:
										splitValue.length > 1
											? splitValue
											: configValue,
								},
							},
						},
					};
				}

				if (row.config.view.content.children) {
					const updatedChildren =
						row.config.view.content.children.map(
							(child) =>
								updateRowInChildren(
									child,
									targetRowId,
									configId,
									configValue
								) || child
						);
					const childUpdated = updatedChildren.some(
						(child, index) =>
							child !== row.config.view.content.children?.[index]
					);
					if (childUpdated) {
						return {
							...row,
							config: {
								...row.config,
								view: {
									...row.config.view,
									content: {
										...row.config.view.content,
										children: updatedChildren,
									},
								},
							},
						};
					}
				}

				if (row.config.view.content.child) {
					const updatedChild = updateRowInChildren(
						row.config.view.content.child,
						targetRowId,
						configId,
						configValue
					);
					if (updatedChild) {
						return {
							...row,
							config: {
								...row.config,
								view: {
									...row.config.view,
									content: {
										...row.config.view.content,
										child: updatedChild,
									},
								},
							},
						};
					}
				}

				return null;
			};

			const newPages = flow.pages.map((page) => {
				const hasAtTopLevel = page.rows.some(
					(r) => r.rowId === action.rowId
				);
				if (hasAtTopLevel) {
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
												splitValue.length > 1
													? splitValue
													: action.configValue,
										},
									},
								},
							};
						}
						return row;
					});
					return { ...page, rows: newRows };
				}

				// If not found as top-level, search recursively in children
				const newRows = page.rows.map(
					(row) =>
						updateRowInChildren(
							row,
							action.rowId,
							action.configId,
							action.configValue
						) || row
				);
				return { ...page, rows: newRows };
			});
			return updateState({ updatedPages: newPages });
		}
		case "SET_ACTIVE_FLOW": {
			return updateState({
				activeFlowId: action.flowId,
				activeRowId: undefined,
			});
		}
		case "SET_ACTIVE_ROW": {
			const page = flow.pages.find((page) =>
				page.rows.some((row) => row.rowId === action.rowId)
			);
			invariant(page, `Page not found for row ${action.rowId}`);

			return updateState({
				activeRowId: action.rowId,
			});
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

type DropIndicatorState = {
	activeRowId: string | null;
	edge: Edge | null;
} | null;

type DropIndicatorAction =
	| {
			type: "SET_ACTIVE_INDICATOR";
			rowId: string | null;
			edge: Edge | null;
	  }
	| {
			type: "CLEAR_INDICATOR";
	  };

const dropIndicatorReducer = (
	state: DropIndicatorState,
	action: DropIndicatorAction
): DropIndicatorState => {
	switch (action.type) {
		case "SET_ACTIVE_INDICATOR":
			if (action.rowId === null) {
				return null;
			}
			return {
				activeRowId: action.rowId,
				edge: action.edge,
			};
		case "CLEAR_INDICATOR":
			return null;
		default:
			return state;
	}
};

export const AppContext = createContext<{
	rows: Row[];
	flows: Flow[];
	activeFlowId?: string;
	activeRowId?: string;
	dragging: DraggingState;
	dropIndicator: DropIndicatorState;
	dispatchRow: Dispatch<RowAction>;
	dispatchDragging: Dispatch<DraggingAction>;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
}>({
	rows: [],
	flows: [],
	dragging: false,
	dropIndicator: null,
	dispatchRow: () => {},
	dispatchDragging: () => {},
	dispatchDropIndicator: () => {},
});

function decodeRow(row: ServerRow): Row {
	const rowId = crypto.randomUUID();
	const baseRow = baseRows.find(
		(baseRow) => row.type === baseRow.config.type
	);
	if (!baseRow) {
		return {
			rowId,
			row: createElement(UnknownRow, { rowId }),
			config: UnknownRow.config,
		};
	} else {
		return {
			rowId,
			row: createElement(baseRow, { rowId }),
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

export function AppProvider({
	children,
	initialFlows,
}: {
	children: ReactNode;
	initialFlows?: ServerFlow[];
}) {
	const rows = baseRows.map((row) => ({
		rowId: row.name,
		row: createElement(row, { rowId: row.name }),
		config: row.config,
	}));

	const flows: ServerFlow[] = initialFlows ?? debugFlows; // Temporary as we build out EVY

	const [appState, dispatchRow] = useReducer(pageReducer, {
		flows: decodeFlows(flows),
		activeFlowId: flows[0]?.id,
	});

	const [dragging, dispatchDragging] = useReducer(draggingReducer, false);
	const [dropIndicator, dispatchDropIndicator] = useReducer(
		dropIndicatorReducer,
		null
	);

	return (
		<AppContext.Provider
			value={{
				rows,
				flows: appState.flows,
				activeFlowId: appState.activeFlowId,
				activeRowId: appState.activeRowId,
				dragging,
				dropIndicator,
				dispatchRow,
				dispatchDragging,
				dispatchDropIndicator,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}
