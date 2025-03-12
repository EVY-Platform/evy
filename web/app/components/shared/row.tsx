import { forwardRef, Fragment, memo, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import invariant from "tiny-invariant";

import {
	attachClosestEdge,
	type Edge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { Box, Grid, Stack, xcss } from "@atlaskit/primitives";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
	draggable,
	dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { dropTargetForExternal } from "@atlaskit/pragmatic-drag-and-drop/external/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { token } from "@atlaskit/tokens";

import { useEditorContext } from "./editor-context.tsx";

export type RowType = {
	rowId: string;
	name: string;
};

type State =
	| { type: "idle" }
	| { type: "preview"; container: HTMLElement; rect: DOMRect }
	| { type: "dragging" };

const idleState: State = { type: "idle" };
const draggingState: State = { type: "dragging" };

const baseStyles = xcss({
	width: "100%",
	padding: "space.100",
	backgroundColor: "elevation.surface",
	borderRadius: "border.radius.200",
	position: "relative",
	":hover": {
		backgroundColor: "elevation.surface.hovered",
	},
});

const stateStyles: {
	[Key in State["type"]]: ReturnType<typeof xcss> | undefined;
} = {
	idle: xcss({
		cursor: "grab",
		boxShadow: "elevation.shadow.raised",
	}),
	dragging: xcss({
		opacity: 0.4,
		boxShadow: "elevation.shadow.raised",
	}),
	// no shadow for preview - the platform will add it's own drop shadow
	preview: undefined,
};

type RowPrimitiveProps = {
	closestEdge: Edge | null;
	item: RowType;
	state: State;
};

const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive({ closestEdge, item, state }, ref) {
		const { name } = item;

		return (
			<Grid
				ref={ref}
				templateColumns="auto 1fr auto"
				columnGap="space.100"
				alignItems="center"
				xcss={[baseStyles, stateStyles[state.type]]}
			>
				<Stack space="space.050" grow="fill">
					{name}
				</Stack>

				{closestEdge && <DropIndicator edge={closestEdge} />}
			</Grid>
		);
	}
);

export const Row = memo(function Row({ item }: { item: RowType }) {
	const ref = useRef<HTMLDivElement | null>(null);
	const { rowId } = item;
	const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
	const [state, setState] = useState<State>(idleState);

	const { instanceId, registerRow } = useEditorContext();
	useEffect(() => {
		invariant(ref.current);
		return registerRow({
			rowId: rowId,
			rowEntry: {
				element: ref.current,
			},
		});
	}, [registerRow, rowId]);

	useEffect(() => {
		const element = ref.current;
		invariant(element);
		return combine(
			draggable({
				element: element,
				getInitialData: () => ({
					type: "row",
					itemId: rowId,
					instanceId,
				}),
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
						render({ container }) {
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
				canDrop: ({ source }) => {
					return (
						source.data.instanceId === instanceId &&
						source.data.type === "row"
					);
				},
				getIsSticky: () => true,
				getData: ({ input, element }) => {
					const data = { type: "row", itemId: rowId };

					return attachClosestEdge(data, {
						input,
						element,
						allowedEdges: ["top", "bottom"],
					});
				},
				onDragEnter: (args) => {
					if (args.source.data.itemId !== rowId) {
						setClosestEdge(extractClosestEdge(args.self.data));
					}
				},
				onDrag: (args) => {
					if (args.source.data.itemId !== rowId) {
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
	}, [instanceId, item, rowId]);

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				item={item}
				state={state}
				closestEdge={closestEdge}
			/>
			{state.type === "preview" &&
				ReactDOM.createPortal(
					<Box
						style={{
							boxSizing: "border-box",
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive
							item={item}
							state={state}
							closestEdge={null}
						/>
					</Box>,
					state.container
				)}
		</Fragment>
	);
});
