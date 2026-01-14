import { type ReactNode, createElement, useReducer } from "react";

import type { ServerFlow } from "../types";
import { AppContext } from "./context";
import {
	pageReducer,
	draggingReducer,
	dropIndicatorReducer,
} from "./reducers";
import { decodeFlows } from "../utils/decodeFlow";
import { baseRows } from "../rows/baseRows";
import { debugFlows } from "../../tests/utils";

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

	const defaultFlows: ServerFlow[] = debugFlows;

	const flows: ServerFlow[] = initialFlows ?? defaultFlows;

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
