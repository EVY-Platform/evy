import React, {
	forwardRef,
	Fragment,
	useMemo,
	useContext,
	useEffect,
	useRef,
	useState,
	useCallback,
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
import { dropTargetForExternal } from "@atlaskit/pragmatic-drag-and-drop/external/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";

import { EVYRow } from "../rows/EVYRow";
import { AppContext } from "../registry";

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
				? "evy-v-dropzone evy-w-full evy-rounded-sm"
				: "evy-h-dropzone evy-min-h-full evy-mt-2 evy-mb-2 evy-rounded-sm";
		}, [orientation]);

		return (
			<>
				{dropzones.includes("before") && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("before") ? "expanded" : ""
						}`}
					/>
				)}
				<div
					className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
					style={{ cursor }}
					ref={ref}
					onClick={selectRow}
				>
					{children}
				</div>
				{dropzones.includes("after") && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("after") ? "expanded" : ""
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
	showDropzoneBefore = false,
	showDropzoneAfter = false,
}: {
	rowId: string;
	children: React.ReactNode;
	selectRow?: () => void;
	orientation?: "horizontal" | "vertical";
	showDropzoneBefore?: boolean;
	showDropzoneAfter?: boolean;
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

	const currentRowPageId = useMemo(() => {
		if (!rowId || !activeFlowId) return;

		return flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((page) =>
				page.rows
					.flatMap(EVYRow.getRowsRecursive)
					.find((r) => r.rowId === rowId)
			)?.id;
	}, [flows, activeFlowId, rowId]);

	const dropzones = useMemo(() => {
		if (!dragging || !currentRowPageId) return;

		if (!dropIndicator?.pageId) return;
		if (currentRowPageId !== dropIndicator?.pageId) return;

		return [
			showDropzoneAfter ? "before" : undefined,
			showDropzoneAfter ? "after" : undefined,
		].filter(Boolean) as Array<"before" | "after">;
	}, [
		dragging,
		currentRowPageId,
		dropIndicator?.pageId,
		dropIndicator?.edge,
	]);

	const indicators = useMemo(() => {
		if (!dragging || !dropzones) return;
		if (dropIndicator?.rowId !== rowId) return;

		const edge = dropIndicator?.edge;
		if (!edge) return;

		return [
			["top", "left"].includes(edge) ? "before" : undefined,
			["bottom", "right"].includes(edge) ? "after" : undefined,
		].filter(Boolean) as Array<"before" | "after">;
	}, [dropIndicator, rowId, dragging, dropzones]);

	const getElementDepth = useCallback((element: HTMLElement): number => {
		let depth = 0;
		let current: HTMLElement | null = element;
		while (current) {
			depth++;
			current = current.parentElement;
		}
		return depth;
	}, []);

	const onDragEvent = useCallback(
		(args: DragEvent) => {
			const element = ref.current;
			invariant(
				element,
				"DraggableRowContainer onDragEvent: ref.current is not defined"
			);

			const draggedRowId = args.source.data.rowId;
			if (draggedRowId === rowId) return;

			const edge = extractClosestEdge(args.self.data);
			if (!edge) return;

			// Check if this row is deeper than the current active indicator
			// by checking if the current active indicator's element contains this element
			const otherElement = document.querySelector(
				`[data-row-id="${dropIndicator?.rowId || ""}"]`
			) as HTMLElement | null;

			let shouldUpdate = false;
			if (!dropIndicator?.rowId || !otherElement) {
				// No active indicator, or can't find the element, so update
				shouldUpdate = true;
			} else if (otherElement.contains(element)) {
				// Current element is inside the other element, so it's deeper
				shouldUpdate = true;
			} else if (element.contains(otherElement)) {
				// Other element is inside current element, so other is deeper, don't update
				shouldUpdate = false;
			} else {
				// Neither contains the other, check DOM depth
				const currentDepth = getElementDepth(element);
				const otherDepth = getElementDepth(otherElement);
				shouldUpdate = currentDepth > otherDepth;
			}

			if (shouldUpdate) {
				dispatchDropIndicator({
					type: "SET_INDICATOR_ROW",
					rowId: rowId,
					edge: edge,
				});
			}
		},
		[dispatchDropIndicator, rowId, getElementDepth, dropIndicator?.rowId]
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
				getIsSticky: () => true,
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
		rowId,
		dropIndicator,
		dispatchDropIndicator,
		allowedEdges,
		getElementDepth,
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
