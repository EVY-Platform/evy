import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";

import { containerDropindicatorId } from "../rows/EVYRow";
import { DropPlaceholderShell } from "./DropPlaceholderShell";
import type { ContainerType } from "../types/row";

export function PlaceholderDropIndicator({
	containerRowId,
	containerType,
}: {
	containerRowId: string;
	containerType: ContainerType;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [isDraggedOver, setIsDraggedOver] = useState(false);

	useEffect(() => {
		const element = ref.current;
		invariant(element, "PlaceholderDropIndicator: ref.current is not defined");

		return dropTargetForElements({
			element,
			canDrop: () => true,
			getData: ({ input, element: targetElement }) =>
				attachClosestEdge(
					{
						rowId: containerDropindicatorId,
						destinationContainerRowId: containerRowId,
						destinationContainerType: containerType,
					},
					{
						input,
						element: targetElement,
						allowedEdges: ["top", "bottom"],
					},
				),
			onDragEnter: () => setIsDraggedOver(true),
			onDragLeave: () => setIsDraggedOver(false),
			onDrop: () => setIsDraggedOver(false),
		});
	}, [containerRowId, containerType]);

	return (
		<DropPlaceholderShell ref={ref} isDraggedOver={isDraggedOver}>
			Drop row here
		</DropPlaceholderShell>
	);
}
