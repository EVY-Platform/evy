import { useRef } from "react";

import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useDragContext } from "../state";
import { rounded24Style } from "./pageStyles";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";

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
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--size-30px)" }}
		>
			<div
				className="evy-overflow-scroll evy-flex evy-flex-col evy-items-center evy-justify-center evy-h-full evy-bg-white"
				style={rounded24Style}
				{...canvasPageInteriorDomProps}
				ref={scrollableRef}
			>
				<div className="evy-text-gray-dark evy-text-sm evy-text-center evy-px-4">
					Drag and drop a row here to add a child
				</div>
			</div>
		</div>
	);
}
