import { useCallback } from "react";

import { attachClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";

import { containerDropindicatorId } from "../rows/EVYRow";
import {
	type DropTargetHighlightDataArgs,
	useDropTargetHighlight,
} from "../hooks/useDropTargetHighlight";
import { DropPlaceholderShell } from "./DropPlaceholderShell";
import type { ContainerType } from "../types/row";

export function PlaceholderDropIndicator({
	containerRowId,
	containerType,
}: {
	containerRowId: string;
	containerType: ContainerType;
}) {
	const getData = useCallback(
		({ input, element }: DropTargetHighlightDataArgs) =>
			attachClosestEdge(
				{
					rowId: containerDropindicatorId,
					destinationContainerRowId: containerRowId,
					destinationContainerType: containerType,
				},
				{
					input,
					element,
					allowedEdges: ["top", "bottom"],
				},
			),
		[containerRowId, containerType],
	);
	const { ref, isDraggedOver } = useDropTargetHighlight(getData);

	return (
		<DropPlaceholderShell ref={ref} isDraggedOver={isDraggedOver}>
			Drop row here
		</DropPlaceholderShell>
	);
}
