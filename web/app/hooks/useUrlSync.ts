import { useEffect, useRef, type Dispatch } from "react";

import type { RowAction } from "../types/actions";
import type { UI_Flow } from "../types/flow";
import { buildUrlPath, parseUrlPath, resolveUrlIds } from "../utils/urlUtils";

export function useUrlSync(
	activeFlowId: string | undefined,
	activePageId: string | undefined,
	flows: UI_Flow[],
	dispatchRow: Dispatch<RowAction>,
) {
	const isInitialMount = useRef(true);
	const isPopStateNavigation = useRef(false);

	useEffect(() => {
		if (isInitialMount.current) {
			isInitialMount.current = false;
			const url = buildUrlPath(activeFlowId, activePageId);
			window.history.replaceState(null, "", url);
			return;
		}

		if (isPopStateNavigation.current) {
			isPopStateNavigation.current = false;
			return;
		}

		const url = buildUrlPath(activeFlowId, activePageId);
		if (window.location.pathname !== url) {
			window.history.pushState(null, "", url);
		}
	}, [activeFlowId, activePageId]);

	useEffect(() => {
		const handlePopState = () => {
			const { flowId: urlFlowId, pageId: urlPageId } = parseUrlPath();
			const { flowId, pageId } = resolveUrlIds(urlFlowId, urlPageId, flows);
			isPopStateNavigation.current = true;

			if (flowId && flowId !== activeFlowId) {
				dispatchRow({ type: "SET_ACTIVE_FLOW", flowId });
			}
			if (pageId) {
				dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [flows, activeFlowId, dispatchRow]);
}
