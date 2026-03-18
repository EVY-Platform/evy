import type { Dispatch } from "react";
import {
	extractClosestEdge,
	type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";
import invariant from "tiny-invariant";

import type { SDUI_Page } from "../types/flow";
import type { ContainerType } from "../types/row";
import type { RowAction } from "../types/actions";
import { containerDropindicatorId } from "../rows/EVYRow";
import { findContainerById, findContainerOfRow } from "../utils/rowTree";

export function handleDrop(
	args: BaseEventPayload<ElementDragType>,
	pages: SDUI_Page[],
	dispatchRow: Dispatch<RowAction>,
): void {
	const { location, source } = args;
	if (!location.current.dropTargets.length) return;

	const rowId = source.data.rowId;
	invariant(typeof rowId === "string", "handleDrop: rowId is not a string");

	const sourcePageId =
		location.initial.dropTargets[location.initial.dropTargets.length - 1].data
			.pageId;
	invariant(
		typeof sourcePageId === "string",
		"handleDrop: sourcePageId is not a string",
	);

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const destinationPageRecord =
		location.current.dropTargets[location.current.dropTargets.length - 1];
	invariant(
		destinationPageRecord,
		"handleDrop: destinationPageRecord is not defined",
	);

	const rawDestinationPageId = destinationPageRecord.data.pageId;
	invariant(
		typeof rawDestinationPageId === "string",
		"handleDrop: destination pageId is not a string",
	);
	const destinationPageId = rawDestinationPageId;
	if (
		sourcePageId === "rows" &&
		(!destinationPageId || destinationPageId === "rows")
	) {
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

	const destinationPage = pages.find((page) => page.id === destinationPageId);
	invariant(destinationPage, "handleDrop: destinationPage is not defined");

	const dispatchOptions: {
		destinationPageId: string;
		destinationIndex: number;
		destinationContainer?: {
			rowId: string;
			type: ContainerType;
		};
	} = {
		destinationIndex: destinationPage.rows.length,
		destinationPageId,
	};

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const firstDropTarget = location.current.dropTargets[0];
	const destinationRow =
		location.current.dropTargets.length > 1 && !!firstDropTarget?.data.rowId
			? firstDropTarget
			: null;

	const closestEdgeOfTarget: Edge | null = destinationRow
		? extractClosestEdge(destinationRow.data)
		: null;

	if (destinationRow) {
		const destinationRowId = destinationRow.data.rowId;
		invariant(
			typeof destinationRowId === "string",
			"handleDrop: destination rowId is not a string",
		);
		const destinationContainer =
			destinationRowId === containerDropindicatorId
				? (() => {
						const secondTargetRowId =
							location.current.dropTargets[1]?.data.rowId;
						invariant(
							typeof secondTargetRowId === "string",
							"handleDrop: dropTargets[1].rowId is not a string",
						);
						return findContainerById(secondTargetRowId, destinationPage.rows);
					})()
				: findContainerOfRow(destinationRowId, destinationPage.rows);

		// Need to support dropping into nested containers...
		// right now the destinationContainer is 1 layer deep only,
		// we need to be able to tell the indexes of every container down
		if (
			destinationContainer?.type === "children" &&
			destinationContainer.container.config.view.content.children?.length
		) {
			dispatchOptions.destinationIndex =
				destinationContainer.container.config.view.content.children.findIndex(
					(r) => r.id === destinationRow.data.rowId,
				);
		} else if (
			destinationContainer?.type === "child" &&
			destinationContainer.container.config.view.content.child?.id
		) {
			dispatchOptions.destinationIndex = 0;
		} else if (closestEdgeOfTarget && !destinationContainer) {
			const destinationRowIndex = destinationPage.rows.findIndex(
				(r) => r.id === destinationRow.data.rowId,
			);
			dispatchOptions.destinationIndex = destinationRowIndex;
		}

		if (destinationContainer) {
			dispatchOptions.destinationContainer = {
				rowId: destinationContainer.container.id,
				type: destinationContainer.type,
			};
		}
	}

	if (closestEdgeOfTarget === "top" || closestEdgeOfTarget === "left") {
		dispatchOptions.destinationIndex = dispatchOptions.destinationIndex - 1;
	} else if (
		closestEdgeOfTarget === "bottom" ||
		closestEdgeOfTarget === "right"
	) {
		dispatchOptions.destinationIndex = dispatchOptions.destinationIndex + 1;
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
	} else {
		dispatchRow({
			type: "MOVE_ROW",
			rowId,
			originPageId: sourcePageId,
			...dispatchOptions,
		});
	}
}
