import { useLayoutEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import type { Input } from "@atlaskit/pragmatic-drag-and-drop/types";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

export type DropTargetHighlightDataArgs = {
	input: Input;
	element: Element;
};

export function useDropTargetHighlight(
	getData: (args: DropTargetHighlightDataArgs) => Record<string, unknown>,
): { ref: React.RefObject<HTMLDivElement | null>; isDraggedOver: boolean } {
	const ref = useRef<HTMLDivElement | null>(null);
	const [isDraggedOver, setIsDraggedOver] = useState(false);

	useLayoutEffect(() => {
		const element = ref.current;
		invariant(element, "useDropTargetHighlight: ref.current is not defined");

		return dropTargetForElements({
			element,
			canDrop: () => true,
			getData: ({ input, element: targetElement }) =>
				getData({ input, element: targetElement }),
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: () => setIsDraggedOver(false),
		});
	}, [getData]);

	return { ref, isDraggedOver };
}
