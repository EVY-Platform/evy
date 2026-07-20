import { useRef } from "react";

import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useDragContext } from "../state/contexts/DragContext";
import { ChildPageFrame } from "./ChildPageFrame";

/**
 * A blank page shown to the right of the active page when a row-like element is selected.
 * Dropping a row here sets it as the singular child of the parent row.
 */
export function BlankChildPage({
	pageId,
	parentRowId,
	variant,
}: {
	pageId: string;
	parentRowId: string | undefined;
	variant: "full" | "sheet";
}) {
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: parentRowId
			? { destinationContainerRowId: parentRowId }
			: undefined,
	});

	const placeholder =
		variant === "full"
			? "Drop the row you want to use as search result row"
			: "Drop a row to show in the sheet on tap";

	return (
		<ChildPageFrame
			scrollableRef={scrollableRef}
			className="evy-items-center evy-justify-center"
			variant={variant}
		>
			<div className="evy-text-gray-dark evy-text-sm evy-text-center evy-px-4">
				{placeholder}
			</div>
		</ChildPageFrame>
	);
}
