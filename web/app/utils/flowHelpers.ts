/**
 * Looks up a flow by id. Returns undefined when `flowId` is undefined or missing from the list.
 */
export function findFlowById<T extends { id: string }>(
	flows: readonly T[],
	flowId: string | undefined,
): T | undefined {
	if (flowId === undefined) return undefined;
	return flows.find((f) => f.id === flowId);
}
