import {
	createElement,
	type ReactNode,
	useEffect,
	useMemo,
	useReducer,
	useRef,
} from "react";
import {
	type RemoteChange,
	SaveConflictError,
	wsClient,
} from "../api/wsClient";
import { useUrlSync } from "../hooks/useUrlSync";
import { baseRows } from "../rows/baseRows";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../types/resources";
import { applyRemoteRecord } from "../utils/flatGraph";
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

const PALETTE_ROWS = baseRows.map((row) => ({
	id: row.name,
	row: createElement(row, { key: row.name, rowId: row.name }),
	config: row.config,
}));

export function AppProvider({
	children,
	initialFlowGraph,
	serviceResources = [],
	resourceAttributeMetadata = [],
	serviceNamesById = new Map(),
	syncWithApi = true,
}: {
	children: ReactNode;
	initialFlowGraph: FlowEntityCollections;
	serviceResources?: ServiceResource[];
	resourceAttributeMetadata?: ResourceAttributeMetadata[];
	serviceNamesById?: Map<string, string>;
	syncWithApi?: boolean;
}) {
	const resourceIdToEntityName = useMemo(
		() => resourceNameById(serviceResources),
		[serviceResources],
	);

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
	/** Remote changes applied since the last save, to fold into its baseline. */
	const appliedRemoteChangesRef = useRef<RemoteChange[]>([]);

	// Keep the builder current with other writers. Without this the canvas only
	// ever showed the snapshot loaded at mount, so concurrent editors silently
	// overwrote one another.
	useEffect(() => {
		return wsClient.onDataChanged((changes) => {
			for (const change of changes) {
				// Also queued as a baseline correction: without it the autosave
				// effect reads the applied change as a local edit and writes
				// the record straight back to the server it came from.
				appliedRemoteChangesRef.current.push(change);

				dispatchRow({
					type: "APPLY_REMOTE_RECORD",
					resource: change.resource,
					record: change.record,
					operation: change.operation,
				});
			}
		});
	}, []);

	useEffect(() => {
		const currentMaps = {
			flowsById: appState.flowsById,
			pagesById: appState.pagesById,
			rowsById: appState.rowsById,
		};
		// Replayed through the same function the reducer used, so the baseline
		// moves exactly as far as the remote change did - no further, which
		// leaves a concurrent local edit still needing a save.
		let previousMaps = previousMapsRef.current;
		for (const change of appliedRemoteChangesRef.current) {
			previousMaps = applyRemoteRecord(
				previousMaps,
				change.resource,
				change.record,
				change.operation,
			);
		}
		appliedRemoteChangesRef.current = [];
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
					// A conflict is not a connection problem, and retrying will
					// not fix it - the editor has to see the other change first.
					alert(
						error instanceof SaveConflictError
							? error.message
							: "Failed to save your changes. Please check your connection and try again.",
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
			rows: PALETTE_ROWS,
			flowsById: appState.flowsById,
			pagesById: appState.pagesById,
			rowsById: appState.rowsById,
			serviceResources,
			resourceAttributeMetadata,
			serviceNamesById,
			resourceIdToEntityName,
			activeFlowId: appState.activeFlowId,
			activeRowId: appState.activeRowId,
			activePageId: appState.activePageId,
			configStack: appState.configStack,
			dispatchRow,
		}),
		[
			appState.flowsById,
			appState.pagesById,
			appState.rowsById,
			serviceResources,
			resourceAttributeMetadata,
			serviceNamesById,
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
