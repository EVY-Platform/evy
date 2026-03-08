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
} from "../../utils/rowTree";

export const pageReducer = (state: AppState, action: RowAction): AppState => {
	const flow = state.flows.find((f) => f.id === state.activeFlowId);
	if (!flow) return state;

	const updateState = ({
		updatedPages,
		activeFlowId,
		activeRowId,
		activePageId,
	}: {
		updatedPages?: SDUI_Page[];
		activeFlowId?: string;
		activeRowId?: string;
		activePageId?: string;
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
			...(activeRowId && activeRowId !== state.activeRowId
				? { activeRowId }
				: {}),
			...(activePageId && activePageId !== state.activePageId
				? { activePageId }
				: {}),
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

			return updateState({
				updatedPages: flow.pages,
				activeRowId: action.newRowId,
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
		case "UPDATE_ROW_ACTION": {
			const updater = (row: Row): Row => ({
				...row,
				config: {
					...row.config,
					action: { target: action.target },
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
		case "REMOVE_ROW_ACTION": {
			const updater = (row: Row): Row => {
				const { action: _, ...rest } = row.config;
				return { ...row, config: rest };
			};

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
		case "SET_ACTIVE_FLOW": {
			return updateState({
				activeFlowId: action.flowId,
				activeRowId: undefined,
			});
		}
		case "SET_ACTIVE_ROW": {
			const page = flow.pages.find(
				(page) =>
					page.rows.some((row) => row.id === action.rowId) ||
					page.footer?.id === action.rowId,
			);
			if (!page) return state;

			return updateState({
				activeRowId: action.rowId,
				activePageId: action.pageId,
			});
		}
		case "SET_ACTIVE_PAGE": {
			const page = flow.pages.find((p) => p.id === action.pageId);
			if (!page) return state;

			return {
				...state,
				activePageId: action.pageId,
				activeRowId: undefined,
			};
		}
		case "UPDATE_PAGE_TITLE": {
			const newPages = flow.pages.map((page) =>
				page.id === action.pageId ? { ...page, title: action.title } : page,
			);
			return updateState({ updatedPages: newPages });
		}
		default:
			return state;
	}
};
