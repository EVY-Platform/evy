import invariant from "tiny-invariant";

import type { AppState, RowAction } from "../../types/actions";
import type { UI_Page } from "../../types/flow";
import type { Row } from "../../types/row";
import { baseRows } from "../../rows/baseRows";
import { buildRowForNewPageFromBase } from "../../utils/decodeFlow";
import {
	updateRowInTree,
	findRowInPages,
	findRowIdPathFromPageRoot,
	findRowInSinglePage,
	removeRowFromPage,
	insertRowIntoPage,
} from "../../utils/rowTree";
import { deriveSheetAndFocusFromRowChain } from "../../utils/urlUtils";
import {
	buildNewClientFlow,
	buildNewClientPage,
} from "../../utils/flowFactory";
import { findFlowById } from "../../utils/flowHelpers";

function mapRowAcrossPages(
	pages: UI_Page[],
	rowId: string,
	updater: (row: Row) => Row,
): UI_Page[] {
	return pages.map((page) => ({
		...page,
		rows: updateRowInTree(page.rows, rowId, updater),
		footer: page.footer?.id === rowId ? updater(page.footer) : page.footer,
	}));
}

function rowNameEquals(row: unknown, name: string): boolean {
	if (row === null) return false;
	const n = (row as Record<string, unknown>).name;
	return typeof n === "string" && n === name;
}

function buildPaletteRow(oldRowId: string, newRowId: string): Row | undefined {
	const baseRow = baseRows.find((row) => {
		if (!row || typeof row !== "function") return false;
		return rowNameEquals(row, oldRowId);
	});
	if (!baseRow) return undefined;
	return buildRowForNewPageFromBase(baseRow, newRowId);
}

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
		updatedPages?: UI_Page[];
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

	switch (action.type) {
		case "ADD_ROW": {
			const newRow = buildPaletteRow(action.oldRowId, action.newRowId);
			if (!newRow) return state;

			const page = flow.pages.find((p) => p.id === action.destinationPageId);
			if (!page) return state;

			const updatedPage = insertRowIntoPage(
				page,
				newRow,
				action.destinationIndex,
				action.destinationContainer,
			);

			const updatedPages = flow.pages.map((p) =>
				p.id === action.destinationPageId ? updatedPage : p,
			);

			return updateState({
				updatedPages,
				activeRowId: action.newRowId,
				configStack: [],
			});
		}
		case "ADD_ROW_AS_FOOTER": {
			const footerRow = buildPaletteRow(action.oldRowId, action.newRowId);
			if (!footerRow) return state;

			const pageExists = flow.pages.some(
				(page) => page.id === action.destinationPageId,
			);
			if (!pageExists) return state;

			const updatedPages = flow.pages.map((page) =>
				page.id === action.destinationPageId
					? { ...page, footer: footerRow }
					: page,
			);

			return updateState({
				updatedPages,
				activeRowId: action.newRowId,
				configStack: [],
			});
		}
		case "MOVE_ROW_TO_FOOTER": {
			const moveFooterOriginPage = flow.pages.find(
				(page) => page.id === action.originPageId,
			);
			if (!moveFooterOriginPage) return state;

			const moveFooterRow = findRowInPages(action.rowId, [
				moveFooterOriginPage,
			]);
			if (!moveFooterRow) return state;

			const cleanedPagesForFooter = flow.pages.map((page) =>
				page.id === action.originPageId
					? removeRowFromPage(page, action.rowId)
					: page,
			);
			const finalPagesFooter = cleanedPagesForFooter.map((page) =>
				page.id === action.destinationPageId
					? { ...page, footer: moveFooterRow }
					: page,
			);

			return updateState({
				updatedPages: finalPagesFooter,
				activeRowId: action.rowId,
				configStack: [],
			});
		}
		case "MOVE_ROW": {
			const originPage = flow.pages.find(
				(page) => page.id === action.originPageId,
			);
			if (!originPage) return state;

			const row = findRowInPages(action.rowId, [originPage]);
			invariant(row, "PageReducer moveRow: row is not defined");

			const cleanedOriginPage = removeRowFromPage(originPage, action.rowId);

			const newPages = flow.pages.map((page) => {
				if (
					page.id === action.originPageId &&
					page.id === action.destinationPageId
				) {
					// Same-page move: remove first, then insert into the result.
					const result = insertRowIntoPage(
						cleanedOriginPage,
						row,
						action.destinationIndex,
						action.destinationContainer,
					);
					// If the destination container was a descendant of the dragged row,
					// insertion will fail because the container was removed. No-op.
					return result;
				}
				if (page.id === action.originPageId) {
					return cleanedOriginPage;
				}
				if (page.id === action.destinationPageId) {
					return insertRowIntoPage(
						page,
						row,
						action.destinationIndex,
						action.destinationContainer,
					);
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
						? removeRowFromPage(page, action.rowId)
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

			return updateState({
				updatedPages: mapRowAcrossPages(flow.pages, action.rowId, updater),
			});
		}
		case "UPDATE_ROW_ROOT": {
			const updater = (row: Row): Row => ({
				...row,
				config: {
					...row.config,
					...(action.field === "source"
						? { source: action.value }
						: { destination: action.value }),
				},
			});

			return updateState({
				updatedPages: mapRowAcrossPages(flow.pages, action.rowId, updater),
			});
		}
		case "UPDATE_ROW_ACTIONS": {
			const updater = (row: Row): Row => ({
				...row,
				config: {
					...row.config,
					actions: action.actions,
				},
			});

			return updateState({
				updatedPages: mapRowAcrossPages(flow.pages, action.rowId, updater),
			});
		}
		case "SET_ACTIVE_ROW": {
			const page = flow.pages.find((p) => findRowInSinglePage(p, action.rowId));
			if (!page) return state;

			let rootId: string;
			let stack: string[];
			if (action.configStack !== undefined) {
				rootId = action.rowId;
				stack = action.configStack;
			} else {
				const path = findRowIdPathFromPageRoot(page, action.rowId);
				if (!path) return state;
				rootId = path[0];
				stack = path.slice(1);
			}

			const sheetState = deriveSheetAndFocusFromRowChain(
				flow.pages,
				rootId,
				stack,
			);

			return {
				...state,
				activeRowId: rootId,
				activePageId: page.id,
				configStack: stack,
				focusMode: sheetState.focusMode,
				secondarySheetRowId: sheetState.secondarySheetRowId,
			};
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

			const isSheetNestedRow =
				parentRow.config.type === "SheetContainer" &&
				(parentRow.config.view.content.child?.id === action.childRowId ||
					parentRow.config.view.content.children?.some(
						(c) => c.id === action.childRowId,
					));

			let nextFocusMode = state.focusMode;
			let nextActivePageId = state.activePageId;
			let nextSecondarySheetRowId = state.secondarySheetRowId;

			if (isSheetNestedRow) {
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
			const sheetState =
				state.activeRowId !== undefined
					? deriveSheetAndFocusFromRowChain(
							flow.pages,
							state.activeRowId,
							newStack,
						)
					: { focusMode: false, secondarySheetRowId: undefined };

			return {
				...state,
				configStack: newStack,
				focusMode: sheetState.focusMode,
				secondarySheetRowId: sheetState.secondarySheetRowId,
			};
		}
		default:
			return state;
	}
};
