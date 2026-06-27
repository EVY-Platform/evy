import {
	createElement,
	type ReactNode,
	useEffect,
	useMemo,
	useReducer,
	useRef,
} from "react";
import type { ResourceAttributeMetadata, ServiceResource } from "../api/sync";
import { wsClient } from "../api/wsClient";
import { useUrlSync } from "../hooks/useUrlSync";
import { baseRows } from "../rows/baseRows";
import {
	collectionsEqual,
	collectionsToMaps,
	collectReachableEntityIds,
	type FlowEntityCollections,
	scopeCollectionsToReachableIds,
} from "../utils/flowEntities";
import { resourceNameById } from "../utils/resourcePathDisplay";
import {
	parseUrlPath,
	resolveUrlIds,
	validateRowPathSegmentsForPage,
} from "../utils/urlUtils";
import { DragContext } from "./contexts/DragContext";
import { FlowsContext } from "./contexts/FlowsContext";
import { draggingReducer, dropIndicatorReducer, pageReducer } from "./reducers";

export function AppProvider({
	children,
	initialFlowGraph,
	serviceResources = [],
	resourceAttributeMetadata = [],
	syncWithApi = true,
}: {
	children: ReactNode;
	initialFlowGraph: FlowEntityCollections;
	serviceResources?: ServiceResource[];
	resourceAttributeMetadata?: ResourceAttributeMetadata[];
	syncWithApi?: boolean;
}) {
	const resourceIdToEntityName = useMemo(
		() => resourceNameById(serviceResources),
		[serviceResources],
	);

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
		const maps = collectionsToMaps(initialFlowGraph);

		const { flowId: activeFlowId, pageId: activePageId } = resolveUrlIds(
			urlFlowId,
			urlPageId,
			maps.flowsById,
			maps.pagesById,
		);

		let activeRowId: string | undefined;
		let configStack: string[] = [];

		const page = activePageId ? maps.pagesById[activePageId] : undefined;
		if (page && activeFlowId && rowPathSegments.length > 0) {
			const validated = validateRowPathSegmentsForPage(
				page.id,
				rowPathSegments,
				maps.pagesById,
				maps.rowsById,
			);
			if (validated) {
				activeRowId = validated.rootRowId;
				configStack = validated.configStack;
			}
		}

		return {
			...maps,
			activeFlowId,
			activePageId,
			activeRowId,
			configStack,
		};
	}, [initialFlowGraph]);

	const [appState, dispatchRow] = useReducer(pageReducer, initialState);

	const [dragging, dispatchDragging] = useReducer(draggingReducer, false);
	const [dropIndicator, dispatchDropIndicator] = useReducer(
		dropIndicatorReducer,
		null,
	);

	const previousMapsRef = useRef({
		flowsById: appState.flowsById,
		pagesById: appState.pagesById,
		rowsById: appState.rowsById,
	});

	useEffect(() => {
		const currentMaps = {
			flowsById: appState.flowsById,
			pagesById: appState.pagesById,
			rowsById: appState.rowsById,
		};
		const previousMaps = previousMapsRef.current;
		const previousReachable = collectReachableEntityIds(
			appState.activeFlowId,
			previousMaps,
		);
		const nextReachable = collectReachableEntityIds(
			appState.activeFlowId,
			currentMaps,
		);
		const reachableIds = {
			flowIds: new Set([
				...previousReachable.flowIds,
				...nextReachable.flowIds,
			]),
			pageIds: new Set([
				...previousReachable.pageIds,
				...nextReachable.pageIds,
			]),
			rowIds: new Set([
				...previousReachable.rowIds,
				...nextReachable.rowIds,
			]),
		};
		const previousCollections = scopeCollectionsToReachableIds(
			previousMaps,
			reachableIds,
		);
		const nextCollections = scopeCollectionsToReachableIds(
			currentMaps,
			reachableIds,
		);

		if (
			syncWithApi &&
			appState.activeFlowId &&
			!collectionsEqual(previousCollections, nextCollections)
		) {
			wsClient
				.saveFlowGraph(previousCollections, nextCollections)
				.catch((error) => {
					alert(
						"Failed to save your changes. Please check your connection and try again.",
					);
					console.error("Failed to save flow:", error);
				});
		}

		previousMapsRef.current = currentMaps;
	}, [
		appState.flowsById,
		appState.pagesById,
		appState.rowsById,
		appState.activeFlowId,
		syncWithApi,
	]);

	useUrlSync(
		appState.activeFlowId,
		appState.activePageId,
		appState.activeRowId,
		appState.configStack,
		appState.flowsById,
		appState.pagesById,
		appState.rowsById,
		dispatchRow,
	);

	const flowsContextValue = useMemo(
		() => ({
			rows,
			flowsById: appState.flowsById,
			pagesById: appState.pagesById,
			rowsById: appState.rowsById,
			serviceResources,
			resourceAttributeMetadata,
			resourceIdToEntityName,
			activeFlowId: appState.activeFlowId,
			activeRowId: appState.activeRowId,
			activePageId: appState.activePageId,
			configStack: appState.configStack,
			dispatchRow,
		}),
		[
			rows,
			appState.flowsById,
			appState.pagesById,
			appState.rowsById,
			serviceResources,
			resourceAttributeMetadata,
			resourceIdToEntityName,
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
