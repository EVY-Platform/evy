import { baseRows } from "../../rows/baseRows";
import type { AppState, RowAction } from "../../types/actions";
import { buildRowForNewPageFromBase } from "../../utils/decodeFlow";
import {
	addFlowRecords,
	addPage,
	addRowRecords,
	ensureShowAction,
	findPageIdContainingRow,
	findRowIdPath,
	insertRowIntoPage,
	moveRow,
	moveRowToFooter,
	pageRootIds,
	removePage,
	removeRowFromPage,
	setFooterRow,
	updatePageTitle,
	updateRowActions,
	updateRowField,
} from "../../utils/flatGraph";
import {
	buildNewFlowRecords,
	buildNewPageRecord,
} from "../../utils/flowFactory";
import { rowToFlatRecords } from "../../utils/rowCodec";

const COMMA_SEPARATED_CONTENT_KEYS = new Set(["segments"]);

function configContentValue(
	configId: string,
	configValue: string,
	existingValue: unknown,
): unknown {
	if (
		Array.isArray(existingValue) ||
		COMMA_SEPARATED_CONTENT_KEYS.has(configId)
	) {
		return configValue.split(",").map((value) => value.trim());
	}
	return configValue;
}

function buildFlatPaletteRow(
	oldRowId: string,
	newRowId: string,
):
	| { rootRowId: string; rowRecords: ReturnType<typeof rowToFlatRecords> }
	| undefined {
	const baseRow = baseRows.find(
		(row): row is (typeof baseRows)[number] =>
			typeof row === "function" && row.name === oldRowId,
	);
	if (!baseRow) return undefined;
	const row = buildRowForNewPageFromBase(baseRow, newRowId);
	return { rootRowId: row.id, rowRecords: rowToFlatRecords(row) };
}

type ChildContainerSelection = { activeRowId: string; configStack: string[] };

function resolveChildContainerSelection(
	state: AppState,
	pageId: string,
	destinationContainer: { type: string; rowId: string } | undefined,
	targetRowId: string,
): ChildContainerSelection | null {
	if (destinationContainer?.type !== "child") return null;
	const page = state.pagesById[pageId];
	if (!page) return null;
	const roots = pageRootIds(page);
	const path = findRowIdPath(
		state.rowsById,
		roots,
		destinationContainer.rowId,
	);
	if (!path) return null;
	return {
		activeRowId: path[0],
		configStack: [...path.slice(1), targetRowId],
	};
}

const CLEARED_SELECTION: Partial<AppState> = {
	activePageId: undefined,
	activeRowId: undefined,
	configStack: [],
};

function clearSelection(state: AppState): AppState {
	return { ...state, ...CLEARED_SELECTION };
}

function stacksEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((id, i) => id === b[i]);
}

export const pageReducer = (state: AppState, action: RowAction): AppState => {
	if (action.type === "SET_ACTIVE_FLOW") {
		return { ...clearSelection(state), activeFlowId: action.flowId };
	}

	if (action.type === "CREATE_FLOW") {
		const trimmedName = action.name.trim();
		if (trimmedName === "") return state;
		const { flow, page } = buildNewFlowRecords(trimmedName);
		const nextMaps = addFlowRecords(state, flow, [page], []);
		return {
			...state,
			...nextMaps,
			activeFlowId: flow.id,
			activePageId: page.id,
			activeRowId: undefined,
			configStack: [],
		};
	}

	if (action.type === "ADD_PAGE") {
		const activeFlowId = state.activeFlowId;
		if (!activeFlowId) return state;
		const page = buildNewPageRecord();
		const nextMaps = addPage(state, activeFlowId, page);
		return {
			...state,
			...nextMaps,
			activePageId: page.id,
			activeRowId: undefined,
			configStack: [],
		};
	}

	if (!state.activeFlowId) return state;

	switch (action.type) {
		case "ADD_ROW": {
			const built = buildFlatPaletteRow(action.oldRowId, action.newRowId);
			if (!built) return state;

			const { rootRowId, rowRecords } = built;
			let nextMaps = addRowRecords(state, rowRecords);
			nextMaps = insertRowIntoPage(
				nextMaps,
				action.destinationPageId,
				rootRowId,
				action.destinationIndex,
				action.destinationContainer,
			);

			if (action.destinationContainer) {
				const childSelection = resolveChildContainerSelection(
					nextMaps as AppState,
					action.destinationPageId,
					action.destinationContainer,
					rootRowId,
				);
				if (childSelection) {
					const mapsWithShow = ensureShowAction(
						nextMaps,
						action.destinationContainer.rowId,
					);
					return {
						...state,
						...mapsWithShow,
						...childSelection,
					};
				}
			}

			return {
				...state,
				...nextMaps,
				activeRowId: rootRowId,
				configStack: [],
			};
		}

		case "ADD_ROW_AS_FOOTER": {
			const built = buildFlatPaletteRow(action.oldRowId, action.newRowId);
			if (!built) return state;
			const { rootRowId, rowRecords } = built;
			let nextMaps = addRowRecords(state, rowRecords);
			nextMaps = setFooterRow(
				nextMaps,
				action.destinationPageId,
				rootRowId,
			);
			return {
				...state,
				...nextMaps,
				activeRowId: rootRowId,
				configStack: [],
			};
		}

		case "MOVE_ROW_TO_FOOTER": {
			const nextMaps = moveRowToFooter(
				state,
				action.rowId,
				action.originPageId,
				action.destinationPageId,
			);
			return {
				...state,
				...nextMaps,
				activeRowId: action.rowId,
				configStack: [],
			};
		}

		case "MOVE_ROW": {
			const nextMaps = moveRow(
				state,
				action.rowId,
				action.originPageId,
				action.destinationPageId,
				action.destinationIndex,
				action.destinationContainer,
			);

			if (action.destinationContainer) {
				const childSelection = resolveChildContainerSelection(
					nextMaps as AppState,
					action.destinationPageId,
					action.destinationContainer,
					action.rowId,
				);
				if (childSelection) {
					const mapsWithShow = ensureShowAction(
						nextMaps,
						action.destinationContainer.rowId,
					);
					return {
						...state,
						...mapsWithShow,
						...childSelection,
					};
				}
			}

			return {
				...state,
				...nextMaps,
				activeRowId: action.rowId,
				configStack: [],
			};
		}

		case "REMOVE_ROW": {
			const nextMaps = removeRowFromPage(
				state,
				action.pageId,
				action.rowId,
			);
			return { ...state, ...nextMaps };
		}

		case "UPDATE_ROW": {
			const row = state.rowsById[action.rowId];
			if (!row) return state;
			const existingValue = row.data[action.configId];
			const value = configContentValue(
				action.configId,
				action.configValue,
				existingValue,
			);
			const nextMaps = updateRowField(
				state,
				action.rowId,
				action.configId,
				value,
			);
			return { ...state, ...nextMaps };
		}

		case "UPDATE_ROW_ROOT": {
			const nextMaps = updateRowField(
				state,
				action.rowId,
				action.field,
				action.value,
			);
			return { ...state, ...nextMaps };
		}

		case "UPDATE_ROW_ACTIONS": {
			const nextMaps = updateRowActions(
				state,
				action.rowId,
				action.actions,
			);
			return { ...state, ...nextMaps };
		}

		case "SET_ACTIVE_ROW": {
			const pageId = findPageIdContainingRow(
				state,
				state.activeFlowId,
				action.rowId,
			);
			if (!pageId) return state;

			const page = state.pagesById[pageId];
			if (!page) return state;

			let rootId: string;
			let stack: string[];

			if (action.configStack !== undefined) {
				rootId = action.rowId;
				stack = action.configStack;
			} else {
				const roots = pageRootIds(page);
				const path = findRowIdPath(state.rowsById, roots, action.rowId);
				if (!path) return state;
				rootId = path[0];
				stack = path.slice(1);
			}

			if (
				state.activeRowId === rootId &&
				stacksEqual(state.configStack, stack)
			) {
				return clearSelection(state);
			}

			return {
				...state,
				activeRowId: rootId,
				activePageId: pageId,
				configStack: stack,
			};
		}

		case "SET_ACTIVE_PAGE": {
			const page = state.pagesById[action.pageId];
			if (!page) return state;

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
			const nextMaps = updatePageTitle(
				state,
				action.pageId,
				action.title,
			);
			return { ...state, ...nextMaps };
		}

		case "REMOVE_PAGE": {
			const flow = state.flowsById[state.activeFlowId];
			if (!flow || flow.pageIds.length <= 1) return state;
			if (!flow.pageIds.includes(action.pageId)) return state;

			const nextMaps = removePage(
				state,
				state.activeFlowId,
				action.pageId,
			);
			const nextPageIds =
				nextMaps.flowsById[state.activeFlowId]?.pageIds ?? [];

			const wasActive = state.activePageId === action.pageId;
			return {
				...state,
				...nextMaps,
				activePageId: wasActive ? nextPageIds[0] : state.activePageId,
				activeRowId: wasActive ? undefined : state.activeRowId,
				configStack: wasActive ? [] : state.configStack,
			};
		}

		case "PUSH_CONFIG_STACK": {
			const parentRow = state.rowsById[action.parentRowId];
			if (!parentRow) return state;
			return {
				...state,
				configStack: [...state.configStack, action.childRowId],
			};
		}

		case "NAVIGATE_BREADCRUMB": {
			if (state.configStack.length === action.configStackLength) {
				return clearSelection(state);
			}
			return {
				...state,
				configStack: state.configStack.slice(
					0,
					action.configStackLength,
				),
			};
		}

		default:
			return state;
	}
};

