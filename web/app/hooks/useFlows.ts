import { useState, useEffect } from "react";
import type { ServerFlow } from "../types";
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
				const fetchedFlows = await wsClient.getFlows();
				if (!cancelled) {
					setFlows(fetchedFlows);
					setLoading(false);
				}
			} catch (err) {
				if (!cancelled) {
					console.error("Failed to fetch flows from API:", err);
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
