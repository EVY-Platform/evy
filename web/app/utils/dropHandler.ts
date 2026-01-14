import type { Dispatch } from "react";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";
import invariant from "tiny-invariant";

import type {
	Page,
	Edge,
	ContainerType,
	RowAction,
	DraggingAction,
} from "../types";
import { EVYRow, containerDropindicatorId } from "../rows/EVYRow";

export function handleDrop(
	args: BaseEventPayload<ElementDragType>,
	pages: Page[],
	dispatchRow: Dispatch<RowAction>,
	dispatchDragging: Dispatch<DraggingAction>
): void {
	const { location, source } = args;
	if (!location.current.dropTargets.length) return;

	const rowId = source.data.rowId;
	invariant(
		typeof rowId === "string",
		"handleDrop: rowId is not a string"
	);

	const sourcePageId =
		location.initial.dropTargets[
			location.initial.dropTargets.length - 1
		].data.pageId;
	invariant(
		typeof sourcePageId === "string",
		"handleDrop: sourcePageId is not a string"
	);

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const destinationPageRecord =
		location.current.dropTargets[
			location.current.dropTargets.length - 1
		];
	invariant(
		destinationPageRecord,
		"handleDrop: destinationPageRecord is not defined"
	);

	const destinationPageId = destinationPageRecord.data.pageId as string;
	if (
		sourcePageId === "rows" &&
		(!destinationPageId || destinationPageId === "rows")
	) {
		dispatchDragging({ type: "STOP_DRAGGING" });
		return;
	}

	if (destinationPageId === "rows") {
		dispatchRow({
			type: "REMOVE_ROW",
			pageId: sourcePageId,
			rowId,
		});
		return;
	}

	const destinationPage = pages.find(
		(page) => page.id === destinationPageId
	);
	invariant(
		destinationPage,
		"handleDrop: destinationPage is not defined"
	);

	const dispatchOptions: {
		destinationPageId: string;
		destinationIndex: number;
		destinationContainer?: {
			rowId: string;
			type: ContainerType;
		};
	} = {
		destinationIndex: destinationPage.rows.length,
		destinationPageId: destinationPageId,
	};

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const destinationRow =
		location.current.dropTargets.length > 1
			? location.current.dropTargets[0]
			: null;

	const closestEdgeOfTarget: Edge | null = destinationRow
		? extractClosestEdge(destinationRow.data)
		: null;

	if (destinationRow) {
		const destinationRowId = destinationRow.data.rowId as string;
		const destinationContainer =
			destinationRowId === containerDropindicatorId
				? EVYRow.findContainerById(
						// Droptargets is an array returning the rows under the drop cursor,
						// starting with the placeholder indicator and then the container
						// we want that container
						location.current.dropTargets[1].data.rowId as string,
						destinationPage.rows
				  )
				: EVYRow.findContainerOfRow(
						destinationRowId,
						destinationPage.rows
				  );

		// Need to support dropping into nested containers...
		// right now the destinationContainer is 1 layer deep only,
		// we need to be able to tell the indexes of every container down
		if (
			destinationContainer?.type === "children" &&
			destinationContainer.container.config.view.content.children?.length
		) {
			dispatchOptions.destinationIndex =
				destinationContainer.container.config.view.content.children.findIndex(
					(r) => r.rowId === destinationRow.data.rowId
				);
		} else if (
			destinationContainer?.type === "child" &&
			destinationContainer.container.config.view.content.child?.rowId
		) {
			dispatchOptions.destinationIndex = 0;
		} else if (closestEdgeOfTarget && !destinationContainer) {
			const destinationRowIndex = destinationPage.rows.findIndex(
				(r) => r.rowId === destinationRow.data.rowId
			);
			dispatchOptions.destinationIndex = destinationRowIndex;
		}

		if (destinationContainer) {
			dispatchOptions.destinationContainer = {
				rowId: destinationContainer.container.rowId,
				type: destinationContainer.type,
			};
		}
	}

	if (closestEdgeOfTarget === "top" || closestEdgeOfTarget === "left") {
		dispatchOptions.destinationIndex =
			dispatchOptions.destinationIndex - 1;
	} else if (
		closestEdgeOfTarget === "bottom" ||
		closestEdgeOfTarget === "right"
	) {
		dispatchOptions.destinationIndex =
			dispatchOptions.destinationIndex + 1;
	} else {
		dispatchOptions.destinationIndex =
			dispatchOptions.destinationIndex ?? destinationPage.rows.length;
	}

	if (sourcePageId === "rows") {
		dispatchRow({
			type: "ADD_ROW",
			newRowId: crypto.randomUUID(),
			oldRowId: rowId,
			...dispatchOptions,
		});
	} else if (sourcePageId === destinationPageId) {
		dispatchRow({
			type: "MOVE_ROW",
			rowId,
			originPageId: sourcePageId,
			...dispatchOptions,
		});
	} else if (destinationPageId !== sourcePageId) {
		dispatchRow({
			type: "MOVE_ROW",
			rowId,
			originPageId: sourcePageId,
			...dispatchOptions,
		});
	}
}
