import { useState, useEffect } from "react";
import type { SDUI_Flow as ServerFlow } from "evy-types/sdui/evy";
import { wsClient } from "../api/wsClient";

type UseFlowsResult = {
	flows: ServerFlow[] | null;
	loading: boolean;
	error: Error | null;
};

export function useFlows(): UseFlowsResult {
	const [flows, setFlows] = useState<ServerFlow[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetchFlows() {
			try {
				const fetchedFlows = await wsClient.getSDUI();
				if (!cancelled) {
					setFlows(fetchedFlows);
					setLoading(false);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err : new Error(String(err)));
					setLoading(false);
				}
			}
		}

		fetchFlows();

		return () => {
			cancelled = true;
		};
	}, []);

	return { flows, loading, error };
}
