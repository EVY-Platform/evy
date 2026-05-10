import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { DropPlaceholderShell } from "./DropPlaceholderShell";

export function FooterPlaceholderDropIndicator({ pageId }: { pageId: string }) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [isDraggedOver, setIsDraggedOver] = useState(false);

	useEffect(() => {
		const element = ref.current;
		invariant(
			element,
			"FooterPlaceholderDropIndicator: ref.current is not defined",
		);

		return dropTargetForElements({
			element,
			canDrop: () => true,
			getData: () => ({
				destinationIsFooter: true,
				pageId,
			}),
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: () => setIsDraggedOver(false),
		});
	}, [pageId]);

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
