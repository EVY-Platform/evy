import { Fragment, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import invariant from "tiny-invariant";

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

type State = { type: "idle" } | { type: "hovered" };

const idle: State = { type: "idle" };
const hovered: State = { type: "hovered" };

export function CancelOverlay({ dismiss }: { dismiss: () => void }) {
	const ref = useRef<HTMLButtonElement | null>(null);
	const [state, setState] = useState<State>(idle);

	useEffect(() => {
		const element = ref.current;
		invariant(element, "CancelOverlay useEffect: ref.current is not defined");
		return dropTargetForElements({
			element,
			getData: () => ({ pageId: "rows" }),
			canDrop: () => true,
			onDragEnter: () => {
				setState(hovered);
			},
			onDragLeave: () => {
				setState(idle);
			},
		});
	}, []);

	return (
		<Fragment>
			<div
				className="evy-flex evy-absolute evy-inset-y-0 evy-w-full"
				style={{
					opacity: 0.6,
					backgroundColor:
						state.type === idle.type
							? "var(--color-evy-gray-light)"
							: "var(--color-evy-gray)",
				}}
			/>
			<button
				type="button"
				aria-label="Delete"
				className="evy-flex evy-absolute evy-inset-y-0 evy-w-full evy-justify-center evy-border-none evy-bg-transparent evy-cursor-pointer"
				style={{ paddingTop: "200px" }}
				ref={ref}
				onClick={dismiss}
			>
				<Trash2
					style={{ height: "6rem", width: "6rem" }}
					strokeWidth={2}
					aria-hidden
				/>
			</button>
		</Fragment>
	);
}
