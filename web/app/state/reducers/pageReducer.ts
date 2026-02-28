import { createElement } from "react";
import invariant from "tiny-invariant";

import type { AppState, RowAction } from "../../types/actions";
import type { SDUI_Page } from "../../types/flow";
import type { Row } from "../../types/row";
import { EVYRow } from "../../rows/EVYRow";
import { baseRows } from "../../rows/baseRows";

export const pageReducer = (state: AppState, action: RowAction): AppState => {
	const flow = state.flows.find((f) => f.id === state.activeFlowId);
	if (!flow) return state;

	const updateState = ({
		updatedPages,
		activeFlowId,
		activeRowId,
	}: {
		updatedPages?: SDUI_Page[];
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
								: f,
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

	function rowNameEquals(row: unknown, name: string): boolean {
		if (row === null || typeof row !== "object") return false;
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

			const page = flow.pages.find(
				(p) => p.id === action.destinationPageId,
			);
			if (!page) return state;

			if (action.destinationContainer) {
				const destinationRowId = action.destinationContainer.rowId;
				const stepsToDestinationContainer = page.rows
					.flatMap((row, index) => {
						if (row.id === destinationRowId) {
							return [[index]];
						}
						const match = EVYRow.traverseToRowAndGetPath(
							row,
							destinationRowId,
						);
						if (match.length > 0) return [[index, ...match]];
						return [];
					})
					.find((s) => s !== undefined);

				invariant(
					stepsToDestinationContainer?.length,
					"PageReducer addRow: stepsToDestinationContainer is not defined",
				);

				const firstStep = stepsToDestinationContainer[0];
				invariant(
					typeof firstStep === "number",
					"expected number index",
				);
				let path = page.rows[firstStep];
				if (stepsToDestinationContainer.length > 1) {
					path = stepsToDestinationContainer
						.slice(1)
						.reduce((acc: Row, curr: number | "child"): Row => {
							if (curr === "child") {
								const child = acc.config.view.content.child;
								invariant(
									child,
									"PageReducer addRow: child is not defined",
								);
								return child;
							}
							const child =
								acc.config.view.content.children?.[curr];
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
			// TODO: Handle moving containers and nested rows between pages
			// with traverseToRowAndGetPath
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
			const removeRowFromChildren = (
				row: Row,
				targetRowId: string,
			): Row => {
				if (row.config.view.content.children) {
					const filteredChildren =
						row.config.view.content.children.filter(
							(child) => child.id !== targetRowId,
						);
					const updatedChildren = filteredChildren.map((child) =>
						removeRowFromChildren(child, targetRowId),
					);
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
				if (row.config.view.content.child?.id === targetRowId) {
					return {
						...row,
						config: {
							...row.config,
							view: {
								...row.config.view,
								content: {
									...row.config.view.content,
									child: undefined,
								},
							},
						},
					};
				}
				if (row.config.view.content.child) {
					return {
						...row,
						config: {
							...row.config,
							view: {
								...row.config.view,
								content: {
									...row.config.view.content,
									child: removeRowFromChildren(
										row.config.view.content.child,
										targetRowId,
									),
								},
							},
						},
					};
				}
				return row;
			};

			return updateState({
				updatedPages: flow.pages.map((page) =>
					page.id === action.pageId
						? {
								...page,
								rows: page.rows
									.filter((r) => r.id !== action.rowId)
									.map((r) =>
										removeRowFromChildren(r, action.rowId),
									),
							}
						: page,
				),
			});
		}
		case "UPDATE_ROW": {
			const splitValue = action.configValue.split(",");

			const updateRowInChildren = (
				row: Row,
				targetRowId: string,
				configId: string,
				configValue: string,
			): Row | null => {
				if (row.id === targetRowId) {
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
									configValue,
								) || child,
						);
					const childUpdated = updatedChildren.some(
						(child, index) =>
							child !== row.config.view.content.children?.[index],
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
						configValue,
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
					(r) => r.id === action.rowId,
				);
				if (hasAtTopLevel) {
					const newRows = page.rows.map((row) => {
						if (row.id === action.rowId) {
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
							action.configValue,
						) || row,
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
				page.rows.some((row) => row.id === action.rowId),
			);
			if (!page) return state;

			return updateState({
				activeRowId: action.rowId,
			});
		}
		default:
			return state;
	}
};
