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
	closestEdge?: Edge;
	selectRow?: () => void;
	showIndicator?: boolean;
	showDropzone?: boolean;
	showDropzoneBefore?: boolean;
	showDropzoneAfter?: boolean;
	orientation?: "horizontal" | "vertical";
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{
			children,
			state,
			closestEdge,
			selectRow,
			showIndicator = false,
			showDropzone = false,
			showDropzoneBefore = false,
			showDropzoneAfter = false,
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

		const dropzoneClass = useMemo(() => {
			return orientation === "vertical"
				? "evy-h-6 evy-w-full evy-border-dashed-blue evy-rounded-sm"
				: "evy-w-6 evy-min-h-full evy-mt-2 evy-mb-2 evy-border-dashed-blue evy-rounded-sm";
		}, [orientation]);

		const indicatorBeforeClass = useMemo(() => {
			if (!showIndicator) return;
			if (closestEdge !== "top" && closestEdge !== "left") return;
			return "evy-bg-blue";
		}, [showIndicator, closestEdge]);

		const indicatorAfterClass = useMemo(() => {
			if (!showIndicator) return;
			if (closestEdge !== "bottom" && closestEdge !== "right") return;
			return "evy-bg-blue";
		}, [showIndicator, closestEdge]);

		return (
			<>
				{showDropzone && showDropzoneBefore && (
					<div
						className={`${dropzoneClass} ${indicatorBeforeClass}`}
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
				{showDropzone && showDropzoneAfter && (
					<div
						className={`${dropzoneClass} ${indicatorAfterClass}`}
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

	const shouldShowIndicator = useMemo(() => {
		return dropIndicator?.activeRowId === rowId && dragging;
	}, [dropIndicator, rowId, dragging]);

	const allowedEdges = useMemo(() => {
		return orientation === "horizontal" ? columnEdges : rowEdges;
	}, [orientation]);

	const activeRowPage = useMemo(() => {
		if (!dropIndicator?.activeRowId || !activeFlowId) return;

		return flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((page) =>
				page.rows
					.flatMap(EVYRow.getRowsRecursive)
					.find((r) => r.rowId === dropIndicator?.activeRowId)
			);
	}, [flows, activeFlowId, dropIndicator]);

	const currentRowPage = useMemo(() => {
		if (!rowId || !activeFlowId) return;

		return flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((page) =>
				page.rows
					.flatMap(EVYRow.getRowsRecursive)
					.find((r) => r.rowId === rowId)
			);
	}, [flows, activeFlowId, rowId]);

	const shouldShowDropzone = useMemo(() => {
		if (!dragging) return false;
		if (!currentRowPage || !activeRowPage) return false;

		return currentRowPage === activeRowPage;
	}, [dragging, currentRowPage, activeRowPage]);

	const getElementDepth = useCallback((element: HTMLElement): number => {
		let depth = 0;
		let current: HTMLElement | null = element;
		while (current) {
			depth++;
			current = current.parentElement;
		}
		return depth;
	}, []);

	useEffect(() => {
		if (dragging) return;
		dispatchDropIndicator({
			type: "CLEAR_INDICATOR",
		});
	}, [dragging, dispatchDropIndicator]);

	useEffect(() => {
		const element = ref.current;
		invariant(element);

		// Set data attribute for UI tests
		element.setAttribute("data-row-id", rowId);

		return combine(
			draggable({
				element: element,
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
				element: element,
			}),
			dropTargetForElements({
				element: element,
				canDrop: () => true,
				getIsSticky: () => true,
				getData: ({ input, element }: DropTargetEvent) => {
					return attachClosestEdge(
						{ rowId },
						{
							input,
							element,
							allowedEdges,
						}
					);
				},
				onDragEnter: (args: DragEvent) => {
					if (args.source.data.rowId !== rowId) {
						const edge = extractClosestEdge(args.self.data);
						if (edge) {
							// Check if this row is deeper than the current active indicator
							// by checking if the current active indicator's element contains this element
							const otherElement = document.querySelector(
								`[data-row-id="${
									dropIndicator?.activeRowId || ""
								}"]`
							) as HTMLElement | null;

							let shouldUpdate = false;
							if (!dropIndicator?.activeRowId || !otherElement) {
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
								const otherDepth =
									getElementDepth(otherElement);
								shouldUpdate = currentDepth > otherDepth;
							}

							if (shouldUpdate) {
								dispatchDropIndicator({
									type: "SET_ACTIVE_INDICATOR",
									rowId: rowId,
									edge: edge,
								});
							}
						}
					}
				},
				onDrag: (args: DragEvent) => {
					if (args.source.data.rowId !== rowId) {
						const edge = extractClosestEdge(args.self.data);
						if (edge) {
							// Check if this row is deeper than the current active indicator
							const otherElement = document.querySelector(
								`[data-row-id="${
									dropIndicator?.activeRowId || ""
								}"]`
							) as HTMLElement | null;

							let shouldUpdate = false;
							if (!dropIndicator?.activeRowId || !otherElement) {
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
								const otherDepth =
									getElementDepth(otherElement);
								shouldUpdate = currentDepth > otherDepth;
							}

							if (shouldUpdate) {
								dispatchDropIndicator({
									type: "SET_ACTIVE_INDICATOR",
									rowId: rowId,
									edge: edge,
								});
							}
						}
					}
				},
				onDragLeave: () => {
					// Only clear if this is the active indicator
					if (dropIndicator?.activeRowId === rowId) {
						dispatchDropIndicator({
							type: "CLEAR_INDICATOR",
						});
					}
				},
				onDrop: () => {
					dispatchDropIndicator({
						type: "CLEAR_INDICATOR",
					});
				},
			})
		);
	}, [rowId, dropIndicator, dispatchDropIndicator]);

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				state={state}
				closestEdge={dropIndicator?.edge || undefined}
				selectRow={selectRow}
				showIndicator={shouldShowIndicator}
				showDropzone={shouldShowDropzone}
				showDropzoneBefore={showDropzoneBefore}
				showDropzoneAfter={showDropzoneAfter}
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
