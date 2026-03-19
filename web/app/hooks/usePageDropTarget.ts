import { type Dispatch, type RefObject, useEffect } from "react";
import invariant from "tiny-invariant";

import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import type { DropIndicatorAction } from "../types/actions";

export function usePageDropTarget({
	scrollableRef,
	pageId,
	dispatchDropIndicator,
	extraData,
	onClickBackground,
}: {
	scrollableRef: RefObject<HTMLDivElement | null>;
	pageId: string;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
	extraData?: Record<string, string>;
	onClickBackground?: (e: MouseEvent) => void;
}) {
	useEffect(() => {
		invariant(
			scrollableRef.current,
			"usePageDropTarget: scrollableRef.current is not defined",
		);
		const element = scrollableRef.current;

		if (onClickBackground) {
			element.addEventListener("click", onClickBackground);
		}

		const cleanup = combine(
			dropTargetForElements({
				element,
				getData: () => ({ pageId, ...extraData }),
				canDrop: () => true,
				onDrop: () => {
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" });
				},
				onDragEnter: () =>
					dispatchDropIndicator({ type: "SET_INDICATOR_PAGE", pageId }),
				onDragLeave: () =>
					dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE" }),
			}),
			autoScrollForElements({
				element,
				canScroll: () => true,
			}),
		);

		return () => {
			if (onClickBackground) {
				element.removeEventListener("click", onClickBackground);
			}
			cleanup();
		};
	}, [
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData,
		onClickBackground,
	]);
}
