import { useMemo } from "react";

import { useDragContext } from "../state";

type ForcedIndicators = {
	rowId: string;
	indicators: Array<"before" | "after">;
};

/**
 * Shared logic for computing page-edge drop indicator state.
 *
 * Used by AppPage to keep page-edge drop indicator derivation isolated.
 */
export function usePageEdgeIndicators(
	pageId: string,
	lastRowId: string | undefined,
	pageHasRows: boolean,
) {
	const { dropIndicator, dragging } = useDragContext();

	const isPageEdgeActive =
		dragging === "rows" && dropIndicator?.pageId === pageId;

	const isPageEdgeEndActive =
		isPageEdgeActive && dropIndicator?.pageDropPosition === "end";

	const showBlankPageIndicator =
		!pageHasRows &&
		isPageEdgeActive &&
		dropIndicator?.pageDropPosition === "start";

	const edgePosition: "start" | "end" = pageHasRows ? "end" : "start";

	const forcedIndicators = useMemo((): ForcedIndicators | undefined => {
		if (isPageEdgeEndActive && lastRowId) {
			return { rowId: lastRowId, indicators: ["after"] };
		}
		return undefined;
	}, [isPageEdgeEndActive, lastRowId]);

	return { forcedIndicators, showBlankPageIndicator, edgePosition };
}
