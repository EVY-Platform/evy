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
	serviceNamesById: Map<string, string>;
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
	const [serviceNamesById, setServiceNamesById] = useState<
		Map<string, string>
	>(new Map());
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
					serviceNamesById: fetchedServiceNamesById,
				} = await syncWebData();
				if (!cancelled) {
					setFlowGraph(fetchedFlowGraph);
					setServiceResources(fetchedResources);
					setResourceAttributeMetadata(
						fetchedResourceAttributeMetadata,
					);
					setServiceNamesById(fetchedServiceNamesById);
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
		serviceNamesById,
		loading,
		error,
	};
}
