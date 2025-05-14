"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

type State = { type: "idle" } | { type: "hovered" };

const idle: State = { type: "idle" };
const hovered: State = { type: "hovered" };

export function CancelOverlay({ dismiss }: { dismiss: () => void }) {
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
				className="flex absolute w-full h-full opacity-60"
				style={{
					backgroundColor:
						state.type === idle.type
							? "var(--color-evy-editor-hover)"
							: "var(--color-evy-gray)",
				}}
			/>
			<div
				className="flex absolute w-full h-full items-start justify-center pt-32"
				ref={ref}
				onClick={dismiss}
			>
				<img className="h-48" src="/bin.svg" alt="Delete" />
			</div>
		</Fragment>
	);
}
