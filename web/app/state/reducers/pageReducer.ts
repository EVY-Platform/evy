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

import {
	buildNewClientFlow,
	buildNewClientPage,
} from "../../utils/flowFactory";
import { findFlowById } from "../../utils/flowHelpers";

const CLEARED_SELECTION: Partial<AppState> = {
	activePageId: undefined,
	activeRowId: undefined,
	configStack: [],
};

function clearSelection(state: AppState): AppState {
	return { ...state, ...CLEARED_SELECTION };
}

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

function buildPaletteRow(oldRowId: string, newRowId: string): Row | undefined {
	const baseRow = baseRows.find((row) => {
		if (typeof row !== "function") return false;
		return row.name === oldRowId;
	});
	if (!baseRow) return undefined;
	return buildRowForNewPageFromBase(baseRow, newRowId);
}

export const pageReducer = (state: AppState, action: RowAction): AppState => {
	if (action.type === "SET_ACTIVE_FLOW") {
		return { ...clearSelection(state), activeFlowId: action.flowId };
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

			// Toggle: if same row chain is already active, clear selection
			if (
				state.activeRowId === rootId &&
				state.configStack.length === stack.length &&
				state.configStack.every((id, i) => id === stack[i])
			) {
				return clearSelection(state);
			}

			return {
				...state,
				activeRowId: rootId,
				activePageId: page.id,
				configStack: stack,
			};
		}
		case "SET_ACTIVE_PAGE": {
			const page = flow.pages.find((p) => p.id === action.pageId);
			if (!page) return state;

			// Toggle: if same page is already active with no row selected, clear selection
			if (
				state.activePageId === action.pageId &&
				!state.activeRowId &&
				state.configStack.length === 0
			) {
				return clearSelection(state);
			}

			return {
				...state,
				activePageId: action.pageId,
				activeRowId: undefined,
				configStack: [],
			};
		}
		case "CLEAR_ACTIVE_SELECTION": {
			return clearSelection(state);
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
		case "PUSH_CONFIG_STACK": {
			const parentRow = findRowInPages(action.parentRowId, flow.pages);
			if (!parentRow) return state;

			return {
				...state,
				configStack: [...state.configStack, action.childRowId],
			};
		}
		case "NAVIGATE_BREADCRUMB": {
			const newStack = state.configStack.slice(0, action.configStackLength);

			// Toggle: if navigating to the current stack length, clear selection
			if (
				state.configStack.length === action.configStackLength &&
				state.configStack.every((id, i) => id === newStack[i])
			) {
				return clearSelection(state);
			}

			return {
				...state,
				configStack: newStack,
			};
		}
		default:
			return state;
	}
};
