import type React from "react";
import { forwardRef } from "react";

import {
	verticalDropIndicatorBefore,
	verticalDropIndicatorAfter,
	horizontalDropIndicatorBefore,
	horizontalDropIndicatorAfter,
} from "../rows/design-system/dropIndicator";

import { idleState, type DraggableState } from "../hooks/useDraggable";

type RowPrimitiveProps = {
	children: React.ReactNode;
	state: DraggableState;
	selectRow?: () => void;
	indicators?: Array<"before" | "after">;
	orientation?: "horizontal" | "vertical";
	className?: string;
	style?: React.CSSProperties;
	isDraggable?: boolean;
};

export const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{
			children,
			state,
			selectRow,
			indicators = [],
			orientation = "vertical",
			className,
			style,
			isDraggable = true,
		},
		ref,
	) {
		const cursor = isDraggable
			? state.type === idleState.type
				? "grab"
				: "pointer"
			: "default";
		const beforeClass =
			orientation === "vertical"
				? verticalDropIndicatorBefore
				: horizontalDropIndicatorBefore;
		const afterClass =
			orientation === "vertical"
				? verticalDropIndicatorAfter
				: horizontalDropIndicatorAfter;

		const showBefore = indicators.includes("before");
		const showAfter = indicators.includes("after");

		return (
			// biome-ignore lint/a11y/useSemanticElements: This is a drag-and-drop container that requires a div for proper layout
			<div
				className={`evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light${className ? ` ${className}` : ""}`}
				style={{ cursor, ...style }}
				ref={ref}
				onClick={selectRow}
				onKeyDown={(e) => e.key === "Enter" && selectRow?.()}
				role="button"
				tabIndex={0}
			>
				{showBefore && <div className={beforeClass} />}
				{children}
				{showAfter && <div className={afterClass} />}
			</div>
		);
	},
);
