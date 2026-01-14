import type React from "react";
import {
	Fragment,
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import ReactDOM from "react-dom";
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

import { AppContext } from "../state";
import { containerDropindicatorId, EVYRow } from "../rows/EVYRow";
import {
	dropIndicatorExpansionBefore,
	dropIndicatorExpansionAfter,
	horizontalDropIndicator,
	verticalDropIndicator,
} from "../rows/design-system/dropIndicator";

import type { Edge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

const rowEdges: Edge[] = ["top", "bottom"];
const columnEdges: Edge[] = ["left", "right"];

type State =
	| { type: "idle" }
	| { type: "dragging" }
	| { type: "preview"; container: HTMLElement | null; rect: DOMRect | null };

const idleState: State = { type: "idle" };
const draggingState: State = { type: "dragging" };
const previewState: State = { type: "preview", container: null, rect: null };

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

type RowPrimitiveProps = {
	children: React.ReactNode;
	state: State;
	selectRow?: () => void;
	indicators?: Array<"before" | "after">;
	dropzones?: Array<"before" | "after">;
	orientation?: "horizontal" | "vertical";
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{
			children,
			state,
			selectRow,
			indicators = [],
			dropzones = [],
			orientation = "vertical",
		},
		ref
	) {
		const cursor = useMemo(() => {
			return {
				[previewState.type]: "pointer",
				[draggingState.type]: "pointer",
				[idleState.type]: "grab",
			}[state.type];
		}, [state.type]);

		const indicatorClass = useMemo(() => {
			return orientation === "vertical"
				? verticalDropIndicator
				: horizontalDropIndicator;
		}, [orientation]);

		const showBefore = useMemo(
			() => dropzones.includes("before") || indicators.includes("before"),
			[dropzones, indicators]
		);
		const showAfter = useMemo(
			() => dropzones.includes("after") || indicators.includes("after"),
			[dropzones, indicators]
		);

		return (
			<>
				{showBefore && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("before")
								? dropIndicatorExpansionBefore
								: ""
						}`}
					/>
				)}
				{/* biome-ignore lint/a11y/useSemanticElements: This is a drag-and-drop container that requires a div for proper layout */}
				<div
					className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
					style={{ cursor }}
					ref={ref}
					onClick={selectRow}
					onKeyDown={(e) => e.key === "Enter" && selectRow?.()}
					role="button"
					tabIndex={0}
				>
					{children}
				</div>
				{showAfter && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("after")
								? dropIndicatorExpansionAfter
								: ""
						}`}
					/>
				)}
			</>
		);
	}
);

export function DraggableRowContainer({
	rowId,
	children,
	selectRow,
	orientation,
	showIndicators = false,
	previousRowId,
	nextRowId,
}: {
	rowId: string;
	children: React.ReactNode;
	selectRow?: () => void;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	previousRowId?: string;
	nextRowId?: string;
}) {
	const {
		flows,
		activeFlowId,
		dragging,
		dropIndicator,
		dispatchDropIndicator,
	} = useContext(AppContext);
	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idleState);

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
			.find((r) => r.rowId === rowId);
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

	// The goal here is to find out which row's dropzone to set the indicator on.
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
			"DraggableRowContainer useEffect: ref.current is not defined"
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

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				state={state}
				selectRow={selectRow}
				indicators={indicators}
				dropzones={dropzones}
				orientation={orientation}
			>
				{children}
			</RowPrimitive>
			{state.type === "preview" &&
				state.rect &&
				state.container &&
				ReactDOM.createPortal(
					<div
						className="evy-bg-white"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive state={state}>{children}</RowPrimitive>
					</div>,
					state.container
				)}
		</Fragment>
	);
}

export function PlaceholderDropIndicator() {
	return (
		<DraggableRowContainer
			key={containerDropindicatorId}
			rowId={containerDropindicatorId}
			orientation="horizontal"
		>
			<div
				className={`${verticalDropIndicator} ${dropIndicatorExpansionBefore}`}
			/>
		</DraggableRowContainer>
	);
}
