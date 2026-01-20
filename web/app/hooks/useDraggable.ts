import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import invariant from "tiny-invariant";

import {
	attachClosestEdge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
	draggable,
	dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { dropTargetForExternal } from "@atlaskit/pragmatic-drag-and-drop/external/adapter";

import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

import { AppContext } from "../state";
import { EVYRow } from "../rows/EVYRow";

const rowEdges: Edge[] = ["top", "bottom"];
const columnEdges: Edge[] = ["left", "right"];

export type DraggableState =
	| { type: "idle" }
	| { type: "dragging" }
	| { type: "preview"; container: HTMLElement | null; rect: DOMRect | null };

export const idleState: DraggableState = { type: "idle" };
export const draggingState: DraggableState = { type: "dragging" };

type DragEvent = {
	source: { data: Record<string, unknown> };
	self: { data: Record<string | symbol, unknown> };
	location: {
		current: {
			dropTargets: Array<{ data: Record<string, unknown> }>;
		};
	};
};

const getRowId = (data: Record<string, unknown>): string | undefined => {
	const rowId = data.rowId;
	return typeof rowId === "string" ? rowId : undefined;
};

export type UseDraggableOptions = {
	rowId: string;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	previousRowId?: string;
	nextRowId?: string;
};

export type UseDraggableResult = {
	ref: React.RefObject<HTMLDivElement | null>;
	state: DraggableState;
	indicators: Array<"before" | "after"> | undefined;
	dropzones: Array<"before" | "after"> | undefined;
};

export function useDraggable({
	rowId,
	orientation = "vertical",
	showIndicators = false,
	previousRowId,
	nextRowId,
}: UseDraggableOptions): UseDraggableResult {
	const {
		flows,
		activeFlowId,
		dragging,
		dropIndicator,
		dispatchDropIndicator,
	} = useContext(AppContext);

	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<DraggableState>(idleState);

	useEffect(() => {
		ref.current?.setAttribute("data-row-id", rowId);
	}, [rowId]);

	const allowedEdges = useMemo(() => {
		return orientation === "horizontal" ? columnEdges : rowEdges;
	}, [orientation]);

	const currentRow = useMemo(() => {
		return flows
			.find((f) => f.id === activeFlowId)
			?.pages.flatMap((page) => page.rows)
			.flatMap(EVYRow.getRowsRecursive)
			.find((r) => r.id === rowId);
	}, [flows, activeFlowId, rowId]);

	const indicators = useMemo(() => {
		if (!dragging || !showIndicators) return;
		if (dropIndicator?.rowId !== rowId) return;

		const edge = dropIndicator?.edge;
		if (!edge) return;

		return [
			["top", "left"].includes(edge) ? "before" : undefined,
			["bottom", "right"].includes(edge) ? "after" : undefined,
		].filter(Boolean) as Array<"before" | "after">;
	}, [dropIndicator, dragging, rowId, showIndicators]);

	const dropzones = useMemo(() => {
		if (!dragging || !dropIndicator || !showIndicators) return;

		const hideBefore =
			(previousRowId && !dropIndicator.rowId) ||
			(previousRowId &&
				dropIndicator.rowId === previousRowId &&
				dropIndicator.edge !== "bottom");
		const hideAfter =
			(nextRowId &&
				dropIndicator.rowId &&
				dropIndicator.rowId !== nextRowId) ||
			(nextRowId &&
				dropIndicator.rowId === nextRowId &&
				dropIndicator.edge !== "top");

		return [
			hideBefore ? undefined : "before",
			hideAfter ? undefined : "after",
		].filter(Boolean) as Array<"before" | "after">;
	}, [dragging, dropIndicator, previousRowId, nextRowId, showIndicators]);

	const onDragEvent = useCallback(
		(args: DragEvent) => {
			const hoveredRowId = rowId;
			const draggedRowId = getRowId(args.source.data);

			// Ignore events on the same row that we are dragging
			// to avoid odd behavior
			if (draggedRowId === hoveredRowId) return;

			const edge = extractClosestEdge(args.self.data);
			if (!edge) return;

			const hoveredElement = ref.current;
			if (!hoveredElement) return;

			const innermostDropTarget = args.location.current.dropTargets[0];
			if (!innermostDropTarget) return;

			const innermostElementRowId = getRowId(innermostDropTarget.data);
			if (!innermostElementRowId) return;

			dispatchDropIndicator({
				type: "SET_INDICATOR_ROW",
				rowId: innermostElementRowId,
				edge: edge,
			});
		},
		[dispatchDropIndicator, rowId]
	);

	useEffect(() => {
		const element = ref.current;
		invariant(
			element,
			"useDraggable useEffect: ref.current is not defined"
		);

		return combine(
			draggable({
				element,
				getInitialData: () => ({ rowId: rowId }),
				onGenerateDragPreview: ({
					location,
					source,
					nativeSetDragImage,
				}) => {
					const rect = source.element.getBoundingClientRect();

					if (nativeSetDragImage) {
						setCustomNativeDragPreview({
							nativeSetDragImage,
							getOffset: preserveOffsetOnSource({
								element,
								input: location.current.input,
							}),
							render({ container }: { container: HTMLElement }) {
								setState({ type: "preview", container, rect });
								return () => setState(draggingState);
							},
						});
					}
				},

				onDragStart: () => setState(draggingState),
				onDrop: () => setState(idleState),
			}),
			dropTargetForExternal({
				element,
			}),
			dropTargetForElements({
				element,
				canDrop: () => true,
				getIsSticky: () =>
					!!currentRow?.config.view.content.children?.length ||
					!!currentRow?.config.view.content.child,
				getData: ({ input, element: targetElement }) =>
					attachClosestEdge(
						{ rowId },
						{
							input,
							element: targetElement,
							allowedEdges,
						}
					),
				onDragEnter: onDragEvent,
				onDrag: onDragEvent,
				onDragLeave: () => {
					if (dropIndicator?.rowId !== rowId) return;

					dispatchDropIndicator({
						type: "UNSET_INDICATOR_ROW",
					});
				},
			})
		);
	}, [
		allowedEdges,
		currentRow?.config.view.content.child,
		currentRow?.config.view.content.children?.length,
		dispatchDropIndicator,
		dropIndicator,
		onDragEvent,
		rowId,
	]);

	return {
		ref,
		state,
		indicators,
		dropzones,
	};
}
