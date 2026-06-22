import { useState, useEffect } from "react";
import type { UI_Flow as ServerFlow } from "evy-types";
import { syncWebData, type ServiceResource } from "../api/sync";

type UseFlowsResult = {
	flows: ServerFlow[] | null;
	serviceResources: ServiceResource[];
	loading: boolean;
	error: Error | null;
};

export function useFlows(): UseFlowsResult {
	const [flows, setFlows] = useState<ServerFlow[] | null>(null);
	const [serviceResources, setServiceResources] = useState<ServiceResource[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetchFlows() {
			try {
				const { flows: fetchedFlows, serviceResources: fetchedResources } =
					await syncWebData();
				if (!cancelled) {
					setFlows(fetchedFlows);
					setServiceResources(fetchedResources);
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

	return { flows, serviceResources, loading, error };
}
