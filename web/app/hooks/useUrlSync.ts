import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { type Dispatch, useEffect, useRef } from "react";
import type { RowAction } from "../types/actions";
import {
	buildUrlPath,
	parseUrlPath,
	resolveUrlIds,
	validateRowPathSegmentsForPage,
} from "../utils/urlUtils";

export function useUrlSync(
	activeFlowId: string | undefined,
	activePageId: string | undefined,
	activeRowId: string | undefined,
	configStack: string[],
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	rowsById: Record<string, DATA_EVY_Row>,
	dispatchRow: Dispatch<RowAction>,
) {
	const isInitialMount = useRef(true);
	const isPopStateNavigation = useRef(false);

	useEffect(() => {
		const rowPathSegments =
			activeRowId !== undefined ? [activeRowId, ...configStack] : [];

		if (isInitialMount.current) {
			isInitialMount.current = false;
			const url = buildUrlPath(
				activeFlowId,
				activePageId,
				rowPathSegments,
			);
			window.history.replaceState(null, "", url);
			return;
		}

		if (isPopStateNavigation.current) {
			isPopStateNavigation.current = false;
			return;
		}

		const url = buildUrlPath(activeFlowId, activePageId, rowPathSegments);
		if (window.location.pathname !== url) {
			window.history.pushState(null, "", url);
		}
	}, [activeFlowId, activePageId, activeRowId, configStack]);

	useEffect(() => {
		const handlePopState = () => {
			const {
				flowId: urlFlowId,
				pageId: urlPageId,
				rowPathSegments,
			} = parseUrlPath();
			const { flowId, pageId } = resolveUrlIds(
				urlFlowId,
				urlPageId,
				flowsById,
				pagesById,
			);
			isPopStateNavigation.current = true;

			if (flowId && flowId !== activeFlowId) {
				dispatchRow({ type: "SET_ACTIVE_FLOW", flowId });
			}

			const page = pagesById[pageId ?? ""];

			if (page && rowPathSegments.length > 0) {
				const validated = validateRowPathSegmentsForPage(
					page.id,
					rowPathSegments,
					pagesById,
					rowsById,
				);
				if (validated) {
					dispatchRow({
						type: "SET_ACTIVE_ROW",
						rowId: validated.rootRowId,
						configStack: validated.configStack,
					});
					return;
				}
			}

			if (pageId) {
				dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [flowsById, pagesById, rowsById, activeFlowId, dispatchRow]);
}
