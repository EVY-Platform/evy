import type React from "react";
import { forwardRef, useMemo } from "react";

import {
	dropIndicatorExpansionBefore,
	dropIndicatorExpansionAfter,
	horizontalDropIndicator,
	verticalDropIndicator,
} from "../rows/design-system/dropIndicator";

import type { DraggableState } from "../hooks/useDraggable";
import { idleState, draggingState } from "../hooks/useDraggable";

const previewState: DraggableState = {
	type: "preview",
	container: null,
	rect: null,
};

type RowPrimitiveProps = {
	children: React.ReactNode;
	state: DraggableState;
	selectRow?: () => void;
	indicators?: Array<"before" | "after">;
	dropzones?: Array<"before" | "after">;
	orientation?: "horizontal" | "vertical";
};

export const RowPrimitive = forwardRef<HTMLDivElement, RowPrimitiveProps>(
	function RowPrimitive(
		{
			children,
			state,
			selectRow,
			indicators = [],
			dropzones = [],
			orientation = "vertical",
		},
		ref,
	) {
		const cursor = useMemo(() => {
			return {
				[previewState.type]: "pointer",
				[draggingState.type]: "pointer",
				[idleState.type]: "grab",
			}[state.type];
		}, [state.type]);

		const indicatorClass = useMemo(() => {
			return orientation === "vertical"
				? verticalDropIndicator
				: horizontalDropIndicator;
		}, [orientation]);

		const showBefore = useMemo(
			() => dropzones.includes("before") || indicators.includes("before"),
			[dropzones, indicators],
		);
		const showAfter = useMemo(
			() => dropzones.includes("after") || indicators.includes("after"),
			[dropzones, indicators],
		);

		return (
			<>
				{showBefore && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("before") ? dropIndicatorExpansionBefore : ""
						}`}
					/>
				)}
				{/* biome-ignore lint/a11y/useSemanticElements: This is a drag-and-drop container that requires a div for proper layout */}
				<div
					className="evy-flex evy-flex-col evy-w-full evy-relative evy-hover:bg-gray-light"
					style={{ cursor }}
					ref={ref}
					onClick={selectRow}
					onKeyDown={(e) => e.key === "Enter" && selectRow?.()}
					role="button"
					tabIndex={0}
				>
					{children}
				</div>
				{showAfter && (
					<div
						className={`${indicatorClass} ${
							indicators.includes("after") ? dropIndicatorExpansionAfter : ""
						}`}
					/>
				)}
			</>
		);
	},
);
