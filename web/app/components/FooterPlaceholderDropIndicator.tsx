import { useCallback } from "react";

import { useDropTargetHighlight } from "../hooks/useDropTargetHighlight";

import { DropPlaceholderShell } from "./DropPlaceholderShell";

export function FooterPlaceholderDropIndicator({ pageId }: { pageId: string }) {
	const getData = useCallback(
		() => ({ destinationIsFooter: true, pageId }),
		[pageId],
	);
	const { ref, isDraggedOver } = useDropTargetHighlight(getData);

	return (
		<DropPlaceholderShell
			ref={ref}
			isDraggedOver={isDraggedOver}
			style={{ flexShrink: 0 }}
		>
			Add footer row
		</DropPlaceholderShell>
	);
}
