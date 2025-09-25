import React, {
	forwardRef,
	Fragment,
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
import DropIndicatorModule from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { dropTargetForExternal } from "@atlaskit/pragmatic-drag-and-drop/external/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";

export type Edge = "top" | "right" | "bottom" | "left";

// Properly typed DropIndicator component for React 19 compatibility
const DropIndicator: React.FC<{ edge: Edge }> = (props) => {
	return DropIndicatorModule(props) as React.ReactElement;
};
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
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive({ closestEdge, children, state, selectRow }, ref) {
		const cursor = {
			[previewState.type]: "pointer",
			[draggingState.type]: "pointer",
			[idleState.type]: "grab",
		}[state.type];

		return (
			<div
				className="flex flex-col w-full relative hover:bg-gray-light"
				style={{ cursor }}
				ref={ref}
				onClick={selectRow}
			>
				{children}
				{closestEdge && <DropIndicator edge={closestEdge} />}
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
	const ref = useRef<HTMLDivElement | null>(null);
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
	const [state, setState] = useState<State>(idleState);

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
				}: any) => {
					const rect = source.element.getBoundingClientRect();

					setCustomNativeDragPreview({
						nativeSetDragImage,
						getOffset: preserveOffsetOnSource({
							element,
							input: location.current.input,
						}),
						render({ container }: any) {
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
				getData: ({ input, element }: any) => {
					return attachClosestEdge(
						{ rowId: rowId },
						{
							input,
							element,
							allowedEdges: ["top", "bottom"],
						}
					);
				},
				onDragEnter: (args: any) => {
					if (args.source.data.rowId !== rowId) {
						setClosestEdge(extractClosestEdge(args.self.data));
					}
				},
				onDrag: (args: any) => {
					if (args.source.data.rowId !== rowId) {
						setClosestEdge(extractClosestEdge(args.self.data));
					}
				},
				onDragLeave: () => {
					setClosestEdge(null);
				},
				onDrop: () => {
					setClosestEdge(null);
				},
			})
		);
	}, [rowId]);

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				state={state}
				closestEdge={closestEdge}
				selectRow={selectRow}
			>
				{children}
			</RowPrimitive>
			{state.type === "preview" &&
				state.rect &&
				state.container &&
				ReactDOM.createPortal(
					<div
						className="flex flex-col bg-gray-light"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive state={state} closestEdge={null}>
							{children}
						</RowPrimitive>
					</div>,
					state.container
				)}
		</Fragment>
	);
}
