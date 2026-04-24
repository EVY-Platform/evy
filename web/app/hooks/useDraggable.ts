import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { useDragContext } from "../state/contexts/DragContext";
import { useRowById } from "./useRowById";

const rowEdges: Edge[] = ["top", "bottom"];
const columnEdges: Edge[] = ["left", "right"];

/** Separator for throttled drop-indicator keys (rowId may contain arbitrary text). */
const DROP_INDICATOR_KEY_SEP = "\u0001";

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

type UseDraggableOptions = {
	rowId: string;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	previousRowId?: string;
	nextRowId?: string;
	isDraggable?: boolean;
};

type UseDraggableResult = {
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
	isDraggable = true,
}: UseDraggableOptions): UseDraggableResult {
	const { dragging, dropIndicator, dispatchDropIndicator } = useDragContext();

	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<DraggableState>(idleState);

	const lastDispatchedDropKey = useRef<string | null>(null);

	useEffect(() => {
		ref.current?.setAttribute("data-row-id", rowId);
	}, [rowId]);

	const allowedEdges = useMemo(() => {
		return orientation === "horizontal" ? columnEdges : rowEdges;
	}, [orientation]);

	const currentRow = useRowById(rowId);

	const indicators = useMemo(() => {
		if (dragging !== "rows" || !showIndicators) return;
		if (dropIndicator?.rowId !== rowId) return;

		const edge = dropIndicator?.edge;
		if (!edge) return;

		return [
			["top", "left"].includes(edge) ? "before" : undefined,
			["bottom", "right"].includes(edge) ? "after" : undefined,
		].filter((x): x is "before" | "after" => x !== undefined);
	}, [dropIndicator, dragging, rowId, showIndicators]);

	const dropzones = useMemo(() => {
		if (dragging !== "rows" || !dropIndicator || !showIndicators) return;

		const hideBefore =
			(previousRowId && !dropIndicator.rowId) ||
			(previousRowId &&
				dropIndicator.rowId === previousRowId &&
				dropIndicator.edge !== "bottom");
		const hideAfter =
			(nextRowId && dropIndicator.rowId && dropIndicator.rowId !== nextRowId) ||
			(nextRowId &&
				dropIndicator.rowId === nextRowId &&
				dropIndicator.edge !== "top");

		return [
			hideBefore ? undefined : "before",
			hideAfter ? undefined : "after",
		].filter((x): x is "before" | "after" => x !== undefined);
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

			const nextKey = `${innermostElementRowId}${DROP_INDICATOR_KEY_SEP}${edge}`;
			if (nextKey === lastDispatchedDropKey.current) {
				return;
			}
			lastDispatchedDropKey.current = nextKey;
			dispatchDropIndicator({
				type: "SET_INDICATOR_ROW",
				rowId: innermostElementRowId,
				edge,
			});
		},
		[dispatchDropIndicator, rowId],
	);

	useEffect(() => {
		const element = ref.current;
		invariant(element, "useDraggable useEffect: ref.current is not defined");

		return combine(
			...(isDraggable
				? [
						draggable({
							element,
							getInitialData: () => ({ rowId: rowId }),
							onGenerateDragPreview: ({
								location,
								source,
								nativeSetDragImage,
							}) => {
								const rect = source.element.getBoundingClientRect();

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
							},

							onDragStart: () => setState(draggingState),
							onDrop: () => setState(idleState),
						}),
					]
				: []),
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
						},
					),
				onDragEnter: onDragEvent,
				onDrag: onDragEvent,
				onDragLeave: () => {
					if (dropIndicator?.rowId !== rowId) return;

					lastDispatchedDropKey.current = null;
					dispatchDropIndicator({
						type: "UNSET_INDICATOR_ROW",
					});
				},
			}),
		);
	}, [
		allowedEdges,
		currentRow?.config.view.content.child,
		currentRow?.config.view.content.children?.length,
		dispatchDropIndicator,
		dropIndicator,
		isDraggable,
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
