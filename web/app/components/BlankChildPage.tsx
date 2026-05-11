import { useRef } from "react";

import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useDragContext } from "../state";
import { ChildPageFrame } from "./ChildPageFrame";

/**
 * A blank page shown to the right of the active page when a row-like element is selected.
 * Dropping a row here sets it as the singular child of the parent row.
 */
export function BlankChildPage({
	parentRowId,
}: {
	parentRowId: string | undefined;
}) {
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const pageId = parentRowId ? `child:${parentRowId}` : "child:none";

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
	});

	return (
		<ChildPageFrame
			scrollableRef={scrollableRef}
			className="evy-items-center evy-justify-center"
		>
			<div className="evy-text-gray-dark evy-text-sm evy-text-center evy-px-4">
				Drag and drop a row here to add a child
			</div>
		</ChildPageFrame>
	);
}
