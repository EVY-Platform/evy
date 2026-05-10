import type React from "react";
import { Fragment, useMemo } from "react";
import ReactDOM from "react-dom";

import { useDraggable, idleState } from "../hooks/useDraggable";
import { RowPrimitive } from "./RowPrimitive";

export function DraggableRowContainer({
	rowId,
	children,
	selectRow,
	orientation,
	showIndicators = false,
	isDraggable = true,
	forcedIndicators,
}: {
	rowId: string;
	children: React.ReactNode;
	selectRow?: () => void;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	isDraggable?: boolean;
	forcedIndicators?: Array<"before" | "after">;
}) {
	const {
		ref,
		state,
		indicators: hookIndicators,
	} = useDraggable({
		rowId,
		orientation,
		showIndicators,
		isDraggable,
	});

	const mergedIndicators = useMemo(() => {
		if (forcedIndicators?.length) {
			return forcedIndicators;
		}
		return hookIndicators;
	}, [forcedIndicators, hookIndicators]);

	return (
		<Fragment>
			<RowPrimitive
				ref={ref}
				state={state}
				selectRow={selectRow}
				indicators={mergedIndicators}
				orientation={orientation}
				isDraggable={isDraggable}
			>
				{children}
			</RowPrimitive>
			{state.type === "preview" &&
				state.rect &&
				state.container &&
				ReactDOM.createPortal(
					<div
						className="evy-bg-white"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive state={idleState}>{children}</RowPrimitive>
					</div>,
					state.container,
				)}
		</Fragment>
	);
}
