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

import { AppContext } from "../registry";
import { containerDropindicatorId, EVYRow } from "../rows/EVYRow";
import {
	dropIndicatorExpansionBefore,
	dropIndicatorExpansionAfter,
	horizontalDropIndicator,
	verticalDropIndicator,
} from "../rows/design-system/dropIndicator";

export type Edge = "top" | "right" | "bottom" | "left";

const rowEdges = ["top", "bottom"];
const columnEdges = ["left", "right"];

interface DragPreviewEvent {
	location: {
		current: {
			input: {
				clientX: number;
				clientY: number;
			};
		};
	};
	source: {
		element: HTMLElement;
		data: { rowId: string };
	};
	nativeSetDragImage: (
		image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
		x: number,
		y: number
	) => void;
}

interface DragEvent {
	source: { data: { rowId: string } };
	self: { data: { rowId: string } };
	location: {
		current: {
			dropTargets: Array<{
				data: {
					rowId: string;
				};
			}>;
		};
	};
}

interface DropTargetEvent {
	input: {
		clientX: number;
		clientY: number;
	};
	element: HTMLElement;
}

type State =
	| { type: "idle" }
	| { type: "dragging" }
	| { type: "preview"; container: HTMLElement | null; rect: DOMRect | null };

const idleState: State = { type: "idle" };
const draggingState: State = { type: "dragging" };
const previewState: State = { type: "preview", container: null, rect: null };

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
				<div
					className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
					style={{ cursor }}
					ref={ref}
					onClick={selectRow}
					onKeyDown={(e) => e.key === "Enter" && selectRow?.()}
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
		if (!dragging || !dropIndicator) return;

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
	}, [dragging, dropIndicator, previousRowId, nextRowId]);

	// The goal here is to find out which row's dropzone to set the indicator on.
	const onDragEvent = useCallback(
		(args: DragEvent) => {
			const hoveredRowId = rowId;
			const draggedRowId = args.source.data.rowId;

			// Ignore events on the same row that we are dragging
			// to avoid odd behavior
			if (draggedRowId === hoveredRowId) return;

			const edge = extractClosestEdge(args.self.data);
			if (!edge) return;

			const hoveredElement = ref.current;
			if (!hoveredElement) return;

			const innermostElementRowId =
				args.location.current.dropTargets[0]?.data.rowId;

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
				}: DragPreviewEvent) => {
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
			dropTargetForExternal({
				element,
			}),
			dropTargetForElements({
				element,
				canDrop: () => true,
				getIsSticky: () =>
					!!currentRow?.config.view.content.children?.length ||
					!!currentRow?.config.view.content.child,
				getData: ({ input, element }: DropTargetEvent) =>
					attachClosestEdge(
						{ rowId },
						{
							input,
							element,
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
		>
			<div
				className={
					verticalDropIndicator + " " + dropIndicatorExpansionBefore
				}
			/>
		</DraggableRowContainer>
	);
}
