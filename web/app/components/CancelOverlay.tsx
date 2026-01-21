import { Fragment, useEffect, useId, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

type State = { type: "idle" } | { type: "hovered" };

const idle: State = { type: "idle" };
const hovered: State = { type: "hovered" };

export function CancelOverlay({ dismiss }: { dismiss: () => void }) {
	const instanceId = useId();
	const ref = useRef<HTMLButtonElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		const element = ref.current;
		invariant(
			element,
			"CancelOverlay useEffect: ref.current is not defined",
		);
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
			}),
		);
	}, []);

	return (
		<Fragment>
			<div
				key={`${instanceId}-overlay`}
				className="evy-flex evy-absolute evy-inset-y-0 evy-w-full evy-opacity-60"
				style={{
					backgroundColor:
						state.type === idle.type
							? "var(--color-evy-gray-light)"
							: "var(--color-evy-gray)",
				}}
			/>
			<button
				key={`${instanceId}-button`}
				type="button"
				className="evy-flex evy-absolute evy-inset-y-0 evy-w-full evy-justify-center evy-pt-32 evy-border-none evy-bg-transparent evy-cursor-pointer"
				ref={ref}
				onClick={dismiss}
			>
				<img className="evy-h-48" src="/bin.svg" alt="Delete" />
			</button>
		</Fragment>
	);
}
