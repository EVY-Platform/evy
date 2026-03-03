import { useContext, useMemo } from "react";

import { AppContext } from "../state";
import type { SDUI_Page } from "../types/flow";

export function useActiveFlow(): {
	pages: SDUI_Page[];
} {
	const { flows, activeFlowId } = useContext(AppContext);

	const pages = useMemo(
		() => flows.find((f) => f.id === activeFlowId)?.pages ?? [],
		[flows, activeFlowId],
	);

	return { pages };
}
