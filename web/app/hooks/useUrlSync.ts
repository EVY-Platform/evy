import { useEffect, useRef, type Dispatch } from "react";

import type { RowAction } from "../types/actions";
import type { UI_Flow } from "../types/flow";
import {
	buildUrlPath,
	parseUrlPath,
	resolveCanonicalPageIdForUrl,
	resolveUrlIds,
	validateRowPathSegmentsForPage,
} from "../utils/urlUtils";
import { findFlowById } from "../utils/flowHelpers";

export function useUrlSync(
	activeFlowId: string | undefined,
	activePageId: string | undefined,
	activeRowId: string | undefined,
	configStack: string[],
	flows: UI_Flow[],
	dispatchRow: Dispatch<RowAction>,
) {
	const isInitialMount = useRef(true);
	const isPopStateNavigation = useRef(false);

	useEffect(() => {
		const canonicalPageId = resolveCanonicalPageIdForUrl(
			flows,
			activeFlowId,
			activePageId,
		);
		const rowPathSegments =
			activeRowId !== undefined ? [activeRowId, ...configStack] : [];

		if (isInitialMount.current) {
			isInitialMount.current = false;
			const url = buildUrlPath(activeFlowId, canonicalPageId, rowPathSegments);
			window.history.replaceState(null, "", url);
			return;
		}

		if (isPopStateNavigation.current) {
			isPopStateNavigation.current = false;
			return;
		}

		const url = buildUrlPath(activeFlowId, canonicalPageId, rowPathSegments);
		if (window.location.pathname !== url) {
			window.history.pushState(null, "", url);
		}
	}, [activeFlowId, activePageId, activeRowId, configStack, flows]);

	useEffect(() => {
		const handlePopState = () => {
			const {
				flowId: urlFlowId,
				pageId: urlPageId,
				rowPathSegments,
			} = parseUrlPath();
			const { flowId, pageId } = resolveUrlIds(urlFlowId, urlPageId, flows);
			isPopStateNavigation.current = true;

			if (flowId && flowId !== activeFlowId) {
				dispatchRow({ type: "SET_ACTIVE_FLOW", flowId });
			}

			const targetFlow = findFlowById(flows, flowId ?? activeFlowId);
			const page = targetFlow?.pages.find((p) => p.id === pageId);

			if (page && rowPathSegments.length > 0) {
				const validated = validateRowPathSegmentsForPage(page, rowPathSegments);
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
	}, [flows, activeFlowId, dispatchRow]);
}
