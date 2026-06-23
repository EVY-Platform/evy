import { useCallback } from "react";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import type { EVYFunctionContext } from "../utils/functions";
import { parseText } from "../utils/interpreter";

export function useParseText() {
	const { resourceIdToEntityName } = useFlowsContext();

	return useCallback(
		(input: string, context?: EVYFunctionContext) =>
			parseText(input, context, resourceIdToEntityName),
		[resourceIdToEntityName],
	);
}
