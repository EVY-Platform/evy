import React, {
	forwardRef,
	Fragment,
	useContext,
	useEffect,
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
	closestEdge: Edge | null;
	children: React.ReactNode;
	state: State;
	selectRow?: () => void;
	showIndicator: boolean;
	showDropzone: boolean;
	showDropzoneBefore: boolean;
	showDropzoneAfter: boolean;
	orientation?: "horizontal" | "vertical";
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{
			closestEdge,
			children,
			state,
			selectRow,
			showIndicator,
			showDropzone,
			showDropzoneBefore,
			showDropzoneAfter,
			orientation = "vertical",
		},
		ref
	) {
		const cursor = {
			[previewState.type]: "pointer",
			[draggingState.type]: "pointer",
			[idleState.type]: "grab",
		}[state.type];

		const dropzoneClass =
			orientation === "vertical"
				? "evy-h-4 evy-w-full evy-bg-gray-dark evy-opacity-30"
				: "evy-w-4 evy-min-h-full evy-mt-2 evy-mb-2 evy-bg-gray-dark evy-opacity-30";

		return (
			<>
				{showDropzone && showDropzoneBefore && (
					<div className={dropzoneClass} />
				)}
				<div
					className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
					style={{ cursor }}
					ref={ref}
					onClick={selectRow}
				>
					{children}
					{showIndicator && closestEdge && (
						<div className={`evy-drop-indicator-${closestEdge}`} />
					)}
				</div>
				{showDropzone && showDropzoneAfter && (
					<div className={dropzoneClass} />
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

	const shouldShowIndicator =
		dropIndicator?.activeRowId === rowId && dragging;
	const allowedEdges = orientation === "horizontal" ? columnEdges : rowEdges;

	const activeRowPage =
		dragging &&
		dropIndicator?.activeRowId &&
		flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((page) =>
				page.rows
					.flatMap(EVYRow.getRowsRecursive)
					.find((r) => r.rowId === dropIndicator?.activeRowId)
			);
	const currentRowPage =
		dragging &&
		dropIndicator?.activeRowId &&
		flows
			.find((f) => f.id === activeFlowId)
			?.pages.find((page) =>
				page.rows
					.flatMap(EVYRow.getRowsRecursive)
					.find((r) => r.rowId === rowId)
			);
	const shouldShowDropzone =
		dragging &&
		currentRowPage &&
		activeRowPage &&
		currentRowPage === activeRowPage;

	// Helper function to calculate DOM depth
	function getElementDepth(element: HTMLElement): number {
		let depth = 0;
		let current: HTMLElement | null = element;
		while (current) {
			depth++;
			current = current.parentElement;
		}
		return depth;
	}

	// Clear indicator when dragging stops
	useEffect(() => {
		if (!dragging) {
			dispatchDropIndicator({
				type: "CLEAR_INDICATOR",
			});
		}
	}, [dragging, dispatchDropIndicator]);

	useEffect(() => {
		const element = ref.current;
		invariant(element);
		// Set data attribute for finding the element later
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
				closestEdge={dropIndicator?.edge || null}
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
						className="evy-bg-gray-light"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive
							state={state}
							closestEdge={null}
							showIndicator={false}
							showDropzone={false}
							showDropzoneBefore={false}
							showDropzoneAfter={false}
						>
							{children}
						</RowPrimitive>
					</div>,
					state.container
				)}
		</Fragment>
	);
}
