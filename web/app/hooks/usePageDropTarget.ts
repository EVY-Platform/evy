import { type Dispatch, type RefObject, useLayoutEffect } from "react";
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
	dropTargetRef,
}: {
	scrollableRef: RefObject<HTMLDivElement | null>;
	pageId: string;
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
	extraData?: Record<string, string>;
	onClickBackground?: (e: MouseEvent) => void;
	/** Optional separate element for the page-level drop target. Falls back to scrollableRef. */
	dropTargetRef?: RefObject<HTMLDivElement | null>;
}) {
	useLayoutEffect(() => {
		const pageElement = dropTargetRef?.current ?? scrollableRef.current;
		invariant(pageElement, "usePageDropTarget: page element is not defined");

		if (onClickBackground) {
			pageElement.addEventListener("click", onClickBackground);
		}

		const autoScrollElement = scrollableRef.current;

		const cleanups: Array<() => void> = [
			dropTargetForElements({
				element: pageElement,
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
		];

		if (autoScrollElement) {
			cleanups.push(
				autoScrollForElements({
					element: autoScrollElement,
					canScroll: () => true,
				}),
			);
		}

		const cleanup = combine(...cleanups);

		return () => {
			if (onClickBackground) {
				pageElement.removeEventListener("click", onClickBackground);
			}
			cleanup();
		};
	}, [
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData,
		onClickBackground,
		dropTargetRef,
	]);
}
