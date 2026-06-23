import type { UI_Flow as ServerFlow } from "evy-types";
import { useEffect, useState } from "react";
import {
	type ResourceAttributeMetadata,
	type ServiceResource,
	syncWebData,
} from "../api/sync";

type UseFlowsResult = {
	flows: ServerFlow[] | null;
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
	loading: boolean;
	error: Error | null;
};

export function useFlows(): UseFlowsResult {
	const [flows, setFlows] = useState<ServerFlow[] | null>(null);
	const [serviceResources, setServiceResources] = useState<ServiceResource[]>(
		[],
	);
	const [resourceAttributeMetadata, setResourceAttributeMetadata] = useState<
		ResourceAttributeMetadata[]
	>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function fetchFlows() {
			try {
				const {
					flows: fetchedFlows,
					serviceResources: fetchedResources,
					resourceAttributeMetadata: fetchedResourceAttributeMetadata,
				} = await syncWebData();
				if (!cancelled) {
					setFlows(fetchedFlows);
					setServiceResources(fetchedResources);
					setResourceAttributeMetadata(
						fetchedResourceAttributeMetadata,
					);
					setLoading(false);
				}
			} catch (err) {
				if (!cancelled) {
					setError(
						err instanceof Error ? err : new Error(String(err)),
					);
					setLoading(false);
				}
			}
		}

		fetchFlows();

		return () => {
			cancelled = true;
		};
	}, []);

	return {
		flows,
		serviceResources,
		resourceAttributeMetadata,
		loading,
		error,
	};
}
