import type {
	BaseEventPayload,
	ElementDragType,
} from "@atlaskit/pragmatic-drag-and-drop/types";
import {
	type Edge,
	extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import type { DATA_EVY_Page } from "evy-types";
import type { Dispatch } from "react";
import invariant from "tiny-invariant";
import type { RowAction } from "../types/actions";
import type { ContainerType } from "../types/row";
import {
	type FlowEntityMaps,
	findChildIndexInContainer,
	findContainerByIdInPage,
	findContainerOfRowInPage,
	findPageContainingRow,
	getContainerChildrenCount,
} from "../utils/flatGraph";
import { containerDropindicatorId } from "./rowConstants";

type DropDispatchOptions = {
	destinationPageId: string;
	destinationIndex: number;
	destinationContainer?: {
		rowId: string;
		type: ContainerType;
	};
};

type DropTargetRecord = {
	data: Record<string | symbol, unknown>;
};

type PageDropPosition = "start" | "end";

function getPageDropPosition(
	dropTarget: DropTargetRecord | undefined,
): PageDropPosition | undefined {
	const pageDropPosition = dropTarget?.data.pageDropPosition;
	return pageDropPosition === "start" || pageDropPosition === "end"
		? pageDropPosition
		: undefined;
}

function applyPageDropPosition(
	dispatchOptions: DropDispatchOptions,
	destinationPage: DATA_EVY_Page,
	pageDropPosition: PageDropPosition | undefined,
): void {
	if (pageDropPosition === "start") {
		dispatchOptions.destinationIndex = 0;
		return;
	}

	if (pageDropPosition === "end") {
		dispatchOptions.destinationIndex = destinationPage.rowIds.length;
	}
}

function findFooterDropTarget(
	dropTargets: DropTargetRecord[],
): DropTargetRecord | undefined {
	return dropTargets.find(
		(target) => target.data.destinationIsFooter === true,
	);
}

function dispatchFooterDrop(
	footerDropTarget: DropTargetRecord,
	sourcePageId: string,
	rowId: string,
	dispatchRow: Dispatch<RowAction>,
): void {
	const footerPageId = footerDropTarget.data.pageId;
	invariant(
		typeof footerPageId === "string",
		"handleDrop: footer placeholder pageId is not a string",
	);

	if (sourcePageId === "rows") {
		dispatchRow({
			type: "ADD_ROW_AS_FOOTER",
			newRowId: crypto.randomUUID(),
			oldRowId: rowId,
			destinationPageId: footerPageId,
		});
		return;
	}

	dispatchRow({
		type: "MOVE_ROW_TO_FOOTER",
		rowId,
		originPageId: sourcePageId,
		destinationPageId: footerPageId,
	});
}

function dispatchStandardDrop(
	sourcePageId: string,
	rowId: string,
	dispatchOptions: DropDispatchOptions,
	dispatchRow: Dispatch<RowAction>,
): void {
	if (sourcePageId === "rows") {
		dispatchRow({
			type: "ADD_ROW",
			newRowId: crypto.randomUUID(),
			oldRowId: rowId,
			...dispatchOptions,
		});
		return;
	}

	dispatchRow({
		type: "MOVE_ROW",
		rowId,
		originPageId: sourcePageId,
		...dispatchOptions,
	});
}

function getDestinationContainerRowId(
	dropTarget: DropTargetRecord | undefined,
): string | undefined {
	const destinationContainerRowId =
		dropTarget?.data.destinationContainerRowId;
	return typeof destinationContainerRowId === "string"
		? destinationContainerRowId
		: undefined;
}

export function handleDrop(
	args: BaseEventPayload<ElementDragType>,
	maps: FlowEntityMaps,
	flowId: string,
	dispatchRow: Dispatch<RowAction>,
): void {
	const { location, source } = args;
	if (!location.current.dropTargets.length) return;

	const rowId = source.data.rowId;
	invariant(typeof rowId === "string", "handleDrop: rowId is not a string");

	const rawSourcePageId =
		location.initial.dropTargets[location.initial.dropTargets.length - 1]
			.data.pageId;
	invariant(
		typeof rawSourcePageId === "string",
		"handleDrop: sourcePageId is not a string",
	);

	const sourcePageId = rawSourcePageId;

	const footerDropTarget = findFooterDropTarget(location.current.dropTargets);
	if (footerDropTarget) {
		dispatchFooterDrop(footerDropTarget, sourcePageId, rowId, dispatchRow);
		return;
	}

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const destinationPageRecord =
		location.current.dropTargets[location.current.dropTargets.length - 1];
	invariant(
		destinationPageRecord,
		"handleDrop: destinationPageRecord is not defined",
	);

	const destinationPageId = destinationPageRecord.data.pageId;
	invariant(
		typeof destinationPageId === "string",
		"handleDrop: destination pageId is not a string",
	);
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

	const pageDestinationContainerRowId = getDestinationContainerRowId(
		destinationPageRecord,
	);
	const pageDestinationContainerType =
		destinationPageRecord.data.destinationContainerType;

	const destinationPage = maps.pagesById[destinationPageId];
	invariant(destinationPage, "handleDrop: destinationPage is not defined");

	const dispatchOptions: DropDispatchOptions = {
		destinationIndex: destinationPage.rowIds.length,
		destinationPageId,
	};
	if (pageDestinationContainerRowId) {
		const containerType =
			pageDestinationContainerType === "child" ||
			pageDestinationContainerType === "children" ||
			pageDestinationContainerType === "sheet"
				? pageDestinationContainerType
				: "sheet";
		dispatchOptions.destinationContainer = {
			rowId: pageDestinationContainerRowId,
			type: containerType,
		};
		dispatchOptions.destinationIndex = 0;

		// When dropping into a blank child page, the parent row may be in the
		// footer subtree. Ensure we resolve the correct page by searching for
		// which page actually contains the parent row, not just relying on the
		// drop target's pageId (which may be stale or ambiguous).
		const actualPage = findPageContainingRow(
			maps,
			flowId,
			pageDestinationContainerRowId,
		);
		if (actualPage) {
			if (actualPage !== destinationPage) {
				dispatchOptions.destinationPageId = actualPage.id;
			}
		} else {
			// Should never happen: the parent row must exist in some page.
			console.warn(
				"handleDrop: blank child drop could not locate page for parent row",
				pageDestinationContainerRowId,
			);
		}
	}

	const firstDropTarget = location.current.dropTargets[0];
	const pageDropPosition = getPageDropPosition(firstDropTarget);
	applyPageDropPosition(dispatchOptions, destinationPage, pageDropPosition);

	// If the row was dropped on top of another row,
	// dropTargets is an array with [row, ..., page]
	// Otherwise it is [page]
	const hasDestinationRow =
		!pageDropPosition &&
		location.current.dropTargets.length > 1 &&
		!!firstDropTarget?.data.rowId;
	const destinationRow = hasDestinationRow ? firstDropTarget : null;

	const closestEdgeOfTarget: Edge | null = destinationRow
		? extractClosestEdge(destinationRow.data)
		: null;

	if (destinationRow) {
		const destinationRowId = destinationRow.data.rowId;
		invariant(
			typeof destinationRowId === "string",
			"handleDrop: destination rowId is not a string",
		);

		// Placeholder drop targets carry explicit destination container metadata.
		const isPlaceholderDrop = destinationRowId === containerDropindicatorId;
		const placeholderContainerRowId =
			destinationRow.data.destinationContainerRowId;
		const placeholderContainerType =
			destinationRow.data.destinationContainerType;

		if (
			isPlaceholderDrop &&
			typeof placeholderContainerRowId === "string" &&
			(placeholderContainerType === "child" ||
				placeholderContainerType === "children" ||
				placeholderContainerType === "sheet")
		) {
			// Drop into an empty container placeholder - use explicit metadata.
			dispatchOptions.destinationContainer = {
				rowId: placeholderContainerRowId,
				type: placeholderContainerType,
			};
			dispatchOptions.destinationIndex = 0;
		} else {
			const destinationContainer = isPlaceholderDrop
				? (() => {
						const secondTargetRowId =
							location.current.dropTargets[1]?.data.rowId;
						invariant(
							typeof secondTargetRowId === "string",
							"handleDrop: dropTargets[1].rowId is not a string",
						);
						return findContainerByIdInPage(
							maps,
							destinationPage,
							secondTargetRowId,
						);
					})()
				: findContainerOfRowInPage(
						maps,
						destinationPage,
						destinationRowId,
					);

			if (
				destinationContainer?.type === "children" &&
				getContainerChildrenCount(
					maps,
					destinationContainer.containerRowId,
				) > 0
			) {
				dispatchOptions.destinationIndex = findChildIndexInContainer(
					maps,
					destinationContainer.containerRowId,
					destinationRow.data.rowId as string,
				);
			} else if (
				destinationContainer?.type === "child" ||
				destinationContainer?.type === "sheet"
			) {
				dispatchOptions.destinationIndex = 0;
			} else if (closestEdgeOfTarget && !destinationContainer) {
				const destinationRowIndex = destinationPage.rowIds.indexOf(
					destinationRow.data.rowId as string,
				);
				// If the destination row is the footer root (or otherwise not in page.rowIds),
				// default to appending at the end of the page rows.
				dispatchOptions.destinationIndex =
					destinationRowIndex >= 0
						? destinationRowIndex
						: destinationPage.rowIds.length;
			}

			if (destinationContainer) {
				dispatchOptions.destinationContainer = {
					rowId: destinationContainer.containerRowId,
					type: destinationContainer.type,
				};
			}
		}
	}

	if (closestEdgeOfTarget === "top" || closestEdgeOfTarget === "left") {
		dispatchOptions.destinationIndex = dispatchOptions.destinationIndex - 1;
	} else if (
		closestEdgeOfTarget === "bottom" ||
		closestEdgeOfTarget === "right"
	) {
		dispatchOptions.destinationIndex = dispatchOptions.destinationIndex + 1;
	}

	dispatchStandardDrop(sourcePageId, rowId, dispatchOptions, dispatchRow);
}
