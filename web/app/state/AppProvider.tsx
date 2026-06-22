import {
	type ReactNode,
	createElement,
	useReducer,
	useRef,
	useEffect,
	useMemo,
} from "react";
import type { UI_Flow as ServerFlow } from "evy-types";
import type { ServiceResource } from "../api/sync";

import type { UI_Flow } from "../types/flow";
import { FlowsContext } from "./contexts/FlowsContext";
import { DragContext } from "./contexts/DragContext";
import { pageReducer, draggingReducer, dropIndicatorReducer } from "./reducers";
import { decodeFlows, encodeFlow } from "../utils/decodeFlow";
import { baseRows } from "../rows/baseRows";
import { wsClient } from "../api/wsClient";
import { useUrlSync } from "../hooks/useUrlSync";
import { findFlowById } from "../utils/flowHelpers";
import {
	parseUrlPath,
	resolveUrlIds,
	validateRowPathSegmentsForPage,
} from "../utils/urlUtils";
import { setResourceIdMapping } from "../utils/interpreter";

export function AppProvider({
	children,
	initialFlows,
	serviceResources = [],
	syncWithApi = true,
}: {
	children: ReactNode;
	initialFlows: ServerFlow[];
	serviceResources?: ServiceResource[];
	syncWithApi?: boolean;
}) {
	useEffect(() => {
		setResourceIdMapping(serviceResources);
	}, [serviceResources]);

	const rows = baseRows.map((row) => ({
		id: row.name,
		row: createElement(row, { key: row.name, rowId: row.name }),
		config: row.config,
	}));

	const initialState = useMemo(() => {
		const {
			flowId: urlFlowId,
			pageId: urlPageId,
			rowPathSegments,
		} = parseUrlPath();
		const { flowId: activeFlowId, pageId: activePageId } = resolveUrlIds(
			urlFlowId,
			urlPageId,
			initialFlows,
		);

		const flows = decodeFlows(initialFlows);
		const activeFlow = findFlowById(flows, activeFlowId);
		const page = activeFlow?.pages.find((p) => p.id === activePageId);

		let activeRowId: string | undefined;
		let configStack: string[] = [];

		if (page && activeFlow && rowPathSegments.length > 0) {
			const validated = validateRowPathSegmentsForPage(page, rowPathSegments);
			if (validated) {
				activeRowId = validated.rootRowId;
				configStack = validated.configStack;
			}
		}

		return {
			flows,
			activeFlowId,
			activePageId,
			activeRowId,
			configStack,
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
		appState.activeRowId,
		appState.configStack,
		appState.flows,
		dispatchRow,
	);

	const flowsContextValue = useMemo(
		() => ({
			rows,
			flows: appState.flows,
			serviceResources,
			activeFlowId: appState.activeFlowId,
			activeRowId: appState.activeRowId,
			activePageId: appState.activePageId,
			configStack: appState.configStack,
			dispatchRow,
		}),
		[
			rows,
			appState.flows,
			serviceResources,
			appState.activeFlowId,
			appState.activeRowId,
			appState.activePageId,
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
