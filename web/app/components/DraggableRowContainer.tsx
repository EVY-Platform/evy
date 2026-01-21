import type React from "react";
import { Fragment, useId } from "react";
import ReactDOM from "react-dom";

import { useDraggable, idleState } from "../hooks/useDraggable";
import { RowPrimitive } from "./RowPrimitive";

export function DraggableRowContainer({
	rowId,
	children,
	selectRow,
	orientation,
	showIndicators = false,
	previousRowId,
	nextRowId,
}: {
	rowId: string;
	children: React.ReactNode;
	selectRow?: () => void;
	orientation?: "horizontal" | "vertical";
	showIndicators?: boolean;
	previousRowId?: string;
	nextRowId?: string;
}) {
	const instanceId = useId();
	const { ref, state, indicators, dropzones } = useDraggable({
		rowId,
		orientation,
		showIndicators,
		previousRowId,
		nextRowId,
	});

	return (
		<Fragment>
			<RowPrimitive
				key={`${instanceId}-primitive`}
				ref={ref}
				state={state}
				selectRow={selectRow}
				indicators={indicators}
				dropzones={dropzones}
				orientation={orientation}
			>
				{children}
			</RowPrimitive>
			{state.type === "preview" &&
				state.rect &&
				state.container &&
				ReactDOM.createPortal(
					<div
						key={`${instanceId}-preview`}
						className="evy-bg-white"
						style={{
							width: state.rect.width,
							height: state.rect.height,
						}}
					>
						<RowPrimitive state={idleState}>
							{children}
						</RowPrimitive>
					</div>,
					state.container
				)}
		</Fragment>
	);
}
