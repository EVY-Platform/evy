import { Fragment, memo, useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

type State = { type: "idle" } | { type: "hovered" };

const idle: State = { type: "idle" };
const hovered: State = { type: "hovered" };

export const CancelOverlay = memo(function CancelOverlay() {
	const ref = useRef<HTMLDivElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		const element = ref.current;
		invariant(element);
		return combine(
			dropTargetForElements({
				element: element,
				canDrop: () => true,
				onDragEnter: () => {
					setState(hovered);
				},
				onDragLeave: () => {
					setState(idle);
				},
			})
		);
	}, []);

	return (
		<Fragment>
			<div
				className="flex absolute w-full h-full opacity-50"
				style={{
					backgroundColor:
						state === idle
							? "var(--color-evy-gray)"
							: "var(--color-evy-blue)",
				}}
			/>
			<div
				className="flex absolute w-full h-full items-start justify-center pt-32"
				ref={ref}
			>
				<img className="h-48" src="/bin.svg" alt="Delete" />
			</div>
		</Fragment>
	);
});
