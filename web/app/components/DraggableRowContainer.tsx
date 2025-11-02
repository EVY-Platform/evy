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

import { AppContext } from "../registry";

export type Edge = "top" | "right" | "bottom" | "left";

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
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{ closestEdge, children, state, selectRow, showIndicator },
		ref
	) {
		const cursor = {
			[previewState.type]: "pointer",
			[draggingState.type]: "pointer",
			[idleState.type]: "grab",
		}[state.type];

		return (
			<div
				className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
				style={{ cursor }}
				ref={ref}
				onClick={selectRow}
			>
				{showIndicator && closestEdge === "top" && (
					<div className="evy-h-8 evy-w-full evy-bg-blue evy-opacity-30" />
				)}
				{children}
				{closestEdge && (
					<div
						className={`evy-drop-indicator-${closestEdge} evy-m${closestEdge.charAt(
							0
						)}-8`}
					/>
				)}
				{showIndicator && closestEdge === "bottom" && (
					<div className="evy-h-8 evy-w-full evy-bg-blue evy-opacity-30" />
				)}
			</div>
		);
	}
);

export function DraggableRowContainer({
	rowId,
	children,
	selectRow,
}: {
	rowId: string;
	children: React.ReactNode;
	selectRow?: () => void;
}) {
	const { dragging } = useContext(AppContext);
	const ref = useRef<HTMLDivElement | null>(null);
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
	const [state, setState] = useState<State>(idleState);
	const [showIndicator, setShowIndicator] = useState(false);

	useEffect(() => {
		const element = ref.current;
		invariant(element);
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
						{ rowId: rowId },
						{
							input,
							element,
							allowedEdges: ["top", "bottom"],
						}
					);
				},
				onDragEnter: (args: DragEvent) => {
					if (args.source.data.rowId !== rowId) {
						const edge = extractClosestEdge(args.self.data);
						setClosestEdge(edge);
						if (edge) {
							setShowIndicator(true);
						}
					}
				},
				onDrag: (args: DragEvent) => {
					if (args.source.data.rowId !== rowId) {
						const edge = extractClosestEdge(args.self.data);
						setClosestEdge(edge);
						if (edge) {
							setShowIndicator(true);
						}
					}
				},
				onDragLeave: () => {
					setClosestEdge(null);
					setShowIndicator(false);
				},
				onDrop: () => {
					setClosestEdge(null);
					setShowIndicator(false);
				},
			})
		);
	}, [rowId]);

	useEffect(() => {
		if (!dragging) {
			setShowIndicator(false);
		}
	}, [dragging]);

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				state={state}
				closestEdge={closestEdge}
				selectRow={selectRow}
				showIndicator={showIndicator && dragging}
			>
				{children}
			</RowPrimitive>
			{state.type === "preview" &&
				state.rect &&
				state.container &&
				ReactDOM.createPortal(
					<div
						className="evy-flex evy-flex-col evy-bg-gray-light"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive
							state={state}
							closestEdge={null}
							showIndicator={false}
						>
							{children}
						</RowPrimitive>
					</div>,
					state.container
				)}
		</Fragment>
	);
}
