import {
	type ReactNode,
	createElement,
	useReducer,
	useRef,
	useEffect,
	useMemo,
} from "react";
import type { UI_Flow as ServerFlow } from "evy-types";

import type { UI_Flow } from "../types/flow";
import { FlowsContext } from "./contexts/FlowsContext";
import { DragContext } from "./contexts/DragContext";
import { pageReducer, draggingReducer, dropIndicatorReducer } from "./reducers";
import { decodeFlows, encodeFlow } from "../utils/decodeFlow";
import { baseRows } from "../rows/baseRows";
import { wsClient } from "../api/wsClient";
import { useUrlSync } from "../hooks/useUrlSync";
import { findFlowById } from "../utils/flowHelpers";
import { parseUrlPath, resolveUrlIds } from "../utils/urlUtils";

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

	const initialState = useMemo(() => {
		const { flowId: urlFlowId, pageId: urlPageId } = parseUrlPath();
		const { flowId: activeFlowId, pageId: activePageId } = resolveUrlIds(
			urlFlowId,
			urlPageId,
			initialFlows,
		);

		return {
			flows: decodeFlows(initialFlows),
			activeFlowId,
			activePageId,
			focusMode: false,
			configStack: [],
		};
	}, [initialFlows]);

	const [appState, dispatchRow] = useReducer(pageReducer, initialState);

	const [dragging, dispatchDragging] = useReducer(draggingReducer, false);
	const [dropIndicator, dispatchDropIndicator] = useReducer(
		dropIndicatorReducer,
		null,
	);

	const previousFlowsRef = useRef<UI_Flow[]>(appState.flows);

	useEffect(() => {
		const activeFlow = findFlowById(appState.flows, appState.activeFlowId);
		const previousActiveFlow = findFlowById(
			previousFlowsRef.current,
			appState.activeFlowId,
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

	useUrlSync(
		appState.activeFlowId,
		appState.activePageId,
		appState.flows,
		dispatchRow,
	);

	const flowsContextValue = useMemo(
		() => ({
			rows,
			flows: appState.flows,
			activeFlowId: appState.activeFlowId,
			activeRowId: appState.activeRowId,
			activePageId: appState.activePageId,
			focusMode: appState.focusMode,
			secondarySheetRowId: appState.secondarySheetRowId,
			configStack: appState.configStack,
			dispatchRow,
		}),
		[
			rows,
			appState.flows,
			appState.activeFlowId,
			appState.activeRowId,
			appState.activePageId,
			appState.focusMode,
			appState.secondarySheetRowId,
			appState.configStack,
		],
	);

	const dragContextValue = useMemo(
		() => ({
			dragging,
			dropIndicator,
			dispatchDragging,
			dispatchDropIndicator,
		}),
		[dragging, dropIndicator],
	);

	return (
		<FlowsContext.Provider value={flowsContextValue}>
			<DragContext.Provider value={dragContextValue}>
				{children}
			</DragContext.Provider>
		</FlowsContext.Provider>
	);
}
