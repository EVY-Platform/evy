import { createElement } from "react";
import invariant from "tiny-invariant";

import type { AppState, RowAction } from "../../types/actions";
import type { SDUI_Page } from "../../types/flow";
import type { Row } from "../../types/row";
import { baseRows } from "../../rows/baseRows";
import {
	traverseToRowAndGetPath,
	removeRowFromTree,
	updateRowInTree,
	getRowsRecursive,
	findRowInPages,
} from "../../utils/rowTree";
import {
	buildNewClientFlow,
	buildNewClientPage,
} from "../../utils/flowFactory";
import { findFlowById } from "../../utils/flowHelpers";

export const pageReducer = (state: AppState, action: RowAction): AppState => {
	if (action.type === "SET_ACTIVE_FLOW") {
		return {
			...state,
			activeFlowId: action.flowId,
			activeRowId: undefined,
			configStack: [],
		};
	}

	if (action.type === "CREATE_FLOW") {
		const trimmedName = action.name.trim();
		if (trimmedName === "") return state;
		const newFlow = buildNewClientFlow(trimmedName);
		return {
			...state,
			flows: [...state.flows, newFlow],
			activeFlowId: newFlow.id,
			activeRowId: undefined,
			activePageId: newFlow.pages[0]?.id,
			configStack: [],
		};
	}

	if (action.type === "ADD_PAGE") {
		const activeFlowId = state.activeFlowId;
		if (!activeFlowId) return state;

		const newPage = buildNewClientPage();

		return {
			...state,
			flows: state.flows.map((f) =>
				f.id === activeFlowId ? { ...f, pages: [...f.pages, newPage] } : f,
			),
			activePageId: newPage.id,
			activeRowId: undefined,
			configStack: [],
		};
	}

	const flow = findFlowById(state.flows, state.activeFlowId);
	if (!flow) return state;

	const updateState = ({
		updatedPages,
		activeFlowId,
		activeRowId,
		activePageId,
		configStack,
	}: {
		updatedPages?: SDUI_Page[];
		activeFlowId?: string;
		activeRowId?: string;
		activePageId?: string;
		configStack?: string[];
	}): AppState => {
		return {
			...state,
			...(updatedPages
				? {
						flows: state.flows.map((f) =>
							f.id === state.activeFlowId ? { ...f, pages: updatedPages } : f,
						),
					}
				: {}),
			...(activeFlowId && activeFlowId !== state.activeFlowId
				? { activeFlowId }
				: {}),
			...(activeRowId !== undefined && activeRowId !== state.activeRowId
				? { activeRowId }
				: {}),
			...(activePageId !== undefined && activePageId !== state.activePageId
				? { activePageId }
				: {}),
			...(configStack !== undefined ? { configStack } : {}),
		};
	};

	function rowNameEquals(row: unknown, name: string): boolean {
		if (row === null) return false;
		const n = (row as Record<string, unknown>).name;
		return typeof n === "string" && n === name;
	}

	switch (action.type) {
		case "ADD_ROW": {
			const baseRow = baseRows.find((row) => {
				if (!row || typeof row !== "function") return false;
				return rowNameEquals(row, action.oldRowId);
			});
			if (!baseRow) return state;

			const rowDataAdd: Row = {
				...baseRow,
				id: action.newRowId,
				config: structuredClone(baseRow.config),
				row: createElement(baseRow, { rowId: action.newRowId }),
			};

			const page = flow.pages.find((p) => p.id === action.destinationPageId);
			if (!page) return state;

			if (action.destinationContainer) {
				const destinationRowId = action.destinationContainer.rowId;
				const stepsToDestinationContainer = page.rows
					.flatMap((row, index) => {
						if (row.id === destinationRowId) {
							return [[index]];
						}
						const match = traverseToRowAndGetPath(row, destinationRowId);
						if (match.length > 0) return [[index, ...match]];
						return [];
					})
					.find((s) => s !== undefined);

				invariant(
					stepsToDestinationContainer?.length,
					"PageReducer addRow: stepsToDestinationContainer is not defined",
				);

				const firstStep = stepsToDestinationContainer[0];
				invariant(typeof firstStep === "number", "expected number index");
				let path = page.rows[firstStep];
				if (stepsToDestinationContainer.length > 1) {
					path = stepsToDestinationContainer
						.slice(1)
						.reduce((acc: Row, curr: number | "child"): Row => {
							if (curr === "child") {
								const child = acc.config.view.content.child;
								invariant(child, "PageReducer addRow: child is not defined");
								return child;
							}
							const child = acc.config.view.content.children?.[curr];
							invariant(
								child,
								"PageReducer addRow: children element is not defined",
							);
							return child;
						}, path);
				}

				if (action.destinationContainer.type === "child") {
					path.config.view.content.child = rowDataAdd;
				} else if (action.destinationContainer.type === "children") {
					path.config.view.content.children?.splice(
						action.destinationIndex,
						0,
						rowDataAdd,
					);
				}
			} else {
				page.rows.splice(action.destinationIndex, 0, rowDataAdd);
			}

			const updatedPages = flow.pages.map((p) =>
				p.id === action.destinationPageId ? { ...p, rows: [...p.rows] } : p,
			);

			return updateState({
				updatedPages,
				activeRowId: action.newRowId,
				configStack: [],
			});
		}
		case "MOVE_ROW": {
			const row = flow.pages
				.find((page) => page.id === action.originPageId)
				?.rows.find((r) => r.id === action.rowId);
			invariant(row, "PageReducer moveRow: row is not defined");

			const newPages = flow.pages.map((page) => {
				if (
					page.id === action.originPageId &&
					page.id === action.destinationPageId
				) {
					const destinationItems = [
						...page.rows.filter((r) => r.id !== action.rowId),
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
						rows: page.rows.filter((r) => r.id !== action.rowId),
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
				configStack: [],
			});
		}
		case "REMOVE_ROW": {
			return updateState({
				updatedPages: flow.pages.map((page) =>
					page.id === action.pageId
						? {
								...page,
								rows: removeRowFromTree(page.rows, action.rowId),
							}
						: page,
				),
			});
		}
		case "UPDATE_ROW": {
			const splitValue = action.configValue.split(",");
			const value = splitValue.length > 1 ? splitValue : action.configValue;
			const updater = (row: Row): Row => ({
				...row,
				config: {
					...row.config,
					view: {
						...row.config.view,
						content: {
							...row.config.view.content,
							[action.configId]: value,
						},
					},
				},
			});

			const newPages = flow.pages.map((page) => {
				const updatedFooter =
					page.footer?.id === action.rowId ? updater(page.footer) : page.footer;
				return {
					...page,
					rows: updateRowInTree(page.rows, action.rowId, updater),
					footer: updatedFooter,
				};
			});

			return updateState({ updatedPages: newPages });
		}
		case "UPDATE_ROW_ACTIONS": {
			const updater = (row: Row): Row => ({
				...row,
				config: {
					...row.config,
					actions: action.actions,
				},
			});

			const newPages = flow.pages.map((page) => {
				const updatedFooter =
					page.footer?.id === action.rowId ? updater(page.footer) : page.footer;
				return {
					...page,
					rows: updateRowInTree(page.rows, action.rowId, updater),
					footer: updatedFooter,
				};
			});

			return updateState({ updatedPages: newPages });
		}
		case "SET_ACTIVE_ROW": {
			const page = flow.pages.find(
				(page) =>
					page.rows.some((row) =>
						getRowsRecursive(row).some((r) => r.id === action.rowId),
					) || page.footer?.id === action.rowId,
			);
			if (!page) return state;

			return updateState({
				activeRowId: action.rowId,
				activePageId: action.pageId,
				configStack: [],
			});
		}
		case "SET_ACTIVE_PAGE": {
			const page = flow.pages.find((p) => p.id === action.pageId);
			if (!page) return state;

			return {
				...state,
				activePageId: action.pageId,
				activeRowId: undefined,
				configStack: [],
			};
		}
		case "CLEAR_ACTIVE_SELECTION": {
			return {
				...state,
				activePageId: undefined,
				activeRowId: undefined,
				focusMode: false,
				secondarySheetRowId: undefined,
				configStack: [],
			};
		}
		case "TOGGLE_FOCUS_MODE": {
			const nextFocusMode = !state.focusMode;
			const nextActivePageId =
				nextFocusMode && !state.activePageId
					? flow.pages[0]?.id
					: state.activePageId;

			return {
				...state,
				focusMode: nextFocusMode,
				activePageId: nextActivePageId,
				...(!nextFocusMode
					? { secondarySheetRowId: undefined, configStack: [] }
					: {}),
			};
		}
		case "UPDATE_PAGE_TITLE": {
			const newPages = flow.pages.map((page) =>
				page.id === action.pageId ? { ...page, title: action.title } : page,
			);
			return updateState({ updatedPages: newPages });
		}
		// UI only deletes the active page; reducer still handles arbitrary pageId for tests/future use.
		case "REMOVE_PAGE": {
			if (flow.pages.length <= 1) return state;
			const updatedPages = flow.pages.filter((p) => p.id !== action.pageId);
			if (updatedPages.length === flow.pages.length) return state;

			const wasActivePage = state.activePageId === action.pageId;

			return updateState({
				updatedPages,
				activePageId: wasActivePage ? updatedPages[0]?.id : state.activePageId,
				activeRowId: wasActivePage ? undefined : state.activeRowId,
				configStack: wasActivePage ? [] : state.configStack,
			});
		}
		case "OPEN_SECONDARY_SHEET": {
			return {
				...state,
				secondarySheetRowId: action.sheetRowId,
			};
		}
		case "CLOSE_SECONDARY_SHEET": {
			return {
				...state,
				secondarySheetRowId: undefined,
				configStack: [],
			};
		}
		case "PUSH_CONFIG_STACK": {
			const parentRow = findRowInPages(action.parentRowId, flow.pages);
			if (!parentRow) return state;

			const isSheetChild =
				parentRow.config.type === "SheetContainer" &&
				parentRow.config.view.content.children?.some(
					(c) => c.id === action.childRowId,
				);

			let nextFocusMode = state.focusMode;
			let nextActivePageId = state.activePageId;
			let nextSecondarySheetRowId = state.secondarySheetRowId;

			if (isSheetChild) {
				if (!state.focusMode) {
					nextFocusMode = true;
					nextActivePageId = state.activePageId ?? flow.pages[0]?.id;
				}
				nextSecondarySheetRowId = parentRow.id;
			}

			return {
				...state,
				focusMode: nextFocusMode,
				activePageId: nextActivePageId,
				secondarySheetRowId: nextSecondarySheetRowId,
				configStack: [...state.configStack, action.childRowId],
			};
		}
		case "NAVIGATE_BREADCRUMB": {
			const newStack = state.configStack.slice(0, action.configStackLength);
			const truncated =
				newStack.length < state.configStack.length && state.secondarySheetRowId;

			return {
				...state,
				configStack: newStack,
				...(truncated ? { secondarySheetRowId: undefined } : {}),
			};
		}
		default:
			return state;
	}
};
