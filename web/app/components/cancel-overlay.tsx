import { Fragment, memo, useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { Box, xcss } from "@atlaskit/primitives";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

type State = { type: "idle" } | { type: "hovered" };

const idleState: State = { type: "idle" };
const hoveredState: State = { type: "hovered" };

const baseStyles = xcss({
	position: "absolute",
	width: "100%",
	height: "100%",
	opacity: 0.8,
});

const imageContainerStyles = xcss({
	position: "absolute",
	width: "100%",
	height: "100%",
	display: "flex",
	alignItems: "start",
	justifyContent: "center",
	paddingTop: "space.1000",
});

const stateStyles: {
	[Key in State["type"]]: ReturnType<typeof xcss> | undefined;
} = {
	idle: xcss({
		backgroundColor: "color.background.disabled",
	}),
	hovered: xcss({
		backgroundColor: "color.background.selected.hovered",
	}),
};

export const CancelOverlay = memo(function CancelOverlay() {
	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idleState);

	useEffect(() => {
		const element = ref.current;
		invariant(element);
		return combine(
			dropTargetForElements({
				element: element,
				canDrop: () => true,
				onDragEnter: () => {
					setState(hoveredState);
				},
				onDragLeave: () => {
					setState(idleState);
				},
			})
		);
	}, []);

	return (
		<Fragment>
			<Box xcss={[baseStyles, stateStyles[state.type]]} />
			<Box xcss={imageContainerStyles} ref={ref}>
				<img className="h-32" src="/bin.svg" alt="Delete" />
			</Box>
		</Fragment>
	);
});
