import {
	type ReactNode,
	createElement,
	useReducer,
	useRef,
	useEffect,
} from "react";
import type { SDUI_Flow as ServerFlow } from "evy-types";

import type { SDUI_Flow } from "../types/flow";
import { AppContext } from "./context";
import { pageReducer, draggingReducer, dropIndicatorReducer } from "./reducers";
import { decodeFlows, encodeFlow } from "../utils/decodeFlow";
import { baseRows } from "../rows/baseRows";
import { wsClient } from "../api/wsClient";

export function AppProvider({
	children,
	initialFlows,
	syncWithApi = true,
}: {
	children: ReactNode;
	initialFlows: ServerFlow[];
	syncWithApi?: boolean;
}) {
	const rows = baseRows.map((row) => ({
		id: row.name,
		row: createElement(row, { key: row.name, rowId: row.name }),
		config: row.config,
	}));

	const flows: ServerFlow[] = initialFlows;

	const [appState, dispatchRow] = useReducer(pageReducer, {
		flows: decodeFlows(flows),
		activeFlowId: flows[0]?.id,
		focusMode: false,
	});

	const [dragging, dispatchDragging] = useReducer(draggingReducer, false);
	const [dropIndicator, dispatchDropIndicator] = useReducer(
		dropIndicatorReducer,
		null,
	);

	const previousFlowsRef = useRef<SDUI_Flow[]>(appState.flows);

	useEffect(() => {
		const activeFlow = appState.flows.find(
			(f) => f.id === appState.activeFlowId,
		);
		const previousActiveFlow = previousFlowsRef.current.find(
			(f) => f.id === appState.activeFlowId,
		);

		if (syncWithApi && activeFlow && activeFlow !== previousActiveFlow) {
			wsClient.updateSDUI(encodeFlow(activeFlow)).catch((error) => {
				alert(
					"Failed to save your changes. Please check your connection and try again.",
				);
				console.error("Failed to save flow:", error);
			});
		}

		previousFlowsRef.current = appState.flows;
	}, [appState.flows, appState.activeFlowId, syncWithApi]);

	return (
		<AppContext.Provider
			value={{
				rows,
				flows: appState.flows,
				activeFlowId: appState.activeFlowId,
				activeRowId: appState.activeRowId,
				activePageId: appState.activePageId,
				focusMode: appState.focusMode,
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
