import { useRef } from "react";

import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useDragContext } from "../state/contexts/DragContext";
import { SheetPageFrame } from "./SheetPageFrame";

export function BlankSheetPage({
	pageId,
	parentRowId,
}: {
	pageId: string;
	parentRowId: string | undefined;
}) {
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: parentRowId
			? {
					destinationContainerRowId: parentRowId,
					destinationContainerType: "sheet",
				}
			: undefined,
	});

	return (
		<SheetPageFrame
			scrollableRef={scrollableRef}
			className="evy-items-center evy-justify-center"
		>
			<div className="evy-text-gray-dark evy-text-sm evy-text-center evy-px-4">
				Drop a row to show in the sheet on tap
			</div>
		</SheetPageFrame>
	);
}
