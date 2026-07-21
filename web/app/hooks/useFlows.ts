import { useEffect, useState } from "react";
import { syncWebData } from "../api/sync";
import type {
	ResourceAttributeMetadata,
	ServiceResource,
} from "../types/resources";
import type { FlowEntityCollections } from "../utils/flowEntities";

type UseFlowsResult = {
	flowGraph: FlowEntityCollections | null;
	serviceResources: ServiceResource[];
	resourceAttributeMetadata: ResourceAttributeMetadata[];
	loading: boolean;
	error: Error | null;
};

export function useFlows(): UseFlowsResult {
	const [flowGraph, setFlowGraph] = useState<FlowEntityCollections | null>(
		null,
	);
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
					flowGraph: fetchedFlowGraph,
					serviceResources: fetchedResources,
					resourceAttributeMetadata: fetchedResourceAttributeMetadata,
				} = await syncWebData();
				if (!cancelled) {
					setFlowGraph(fetchedFlowGraph);
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
		flowGraph,
		serviceResources,
		resourceAttributeMetadata,
		loading,
		error,
	};
}
