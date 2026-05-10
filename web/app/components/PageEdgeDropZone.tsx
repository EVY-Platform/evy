import {
	useCallback,
	useEffect,
	useRef,
	type CSSProperties,
	type Dispatch,
} from "react";
import invariant from "tiny-invariant";

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import type { DropIndicatorAction } from "../types/actions";

export function PageEdgeDropZone({
	pageId,
	position,
	dispatchDropIndicator,
	style,
	className,
	onClick,
}: {
	pageId: string;
	position: "start" | "end";
	dispatchDropIndicator: Dispatch<DropIndicatorAction>;
	style?: CSSProperties;
	className?: string;
	onClick?: () => void;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	const setIndicatorPosition = useCallback(() => {
		dispatchDropIndicator({
			type: "SET_INDICATOR_PAGE_POSITION",
			pageId,
			position,
		});
	}, [dispatchDropIndicator, pageId, position]);

	const clearIndicatorPosition = useCallback(() => {
		dispatchDropIndicator({ type: "UNSET_INDICATOR_PAGE_POSITION" });
	}, [dispatchDropIndicator]);

	useEffect(() => {
		const element = ref.current;
		invariant(element, "PageEdgeDropZone: ref.current is not defined");

		return dropTargetForElements({
			element,
			getData: () => ({
				pageId,
				pageDropPosition: position,
			}),
			canDrop: () => true,
			onDragEnter: setIndicatorPosition,
			onDrag: setIndicatorPosition,
			onDragLeave: clearIndicatorPosition,
			onDrop: clearIndicatorPosition,
		});
	}, [clearIndicatorPosition, pageId, position, setIndicatorPosition]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drop target background area
		<div
			ref={ref}
			className={className}
			style={style}
			onClick={onClick}
			onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		/>
	);
}
