import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";
import { EVY_CORE_SERVICE } from "evy-types/coreResources";
import { MARKETPLACE_SERVICE } from "evy-types/marketplaceResources";
import { useCallback, useMemo } from "react";
import type { ServiceResource } from "../../api/sync";
import {
	type ActionFunction,
	parseBranch,
	serializeBranch,
} from "../../utils/actionBranch";
import {
	getFlowOptions,
	getPageOptions,
	toVariableOptions,
} from "../../utils/actionFlowOptions";
import { displayLabel } from "../../utils/labelFormatting";
import { type PopoverOption, PopoverSelect } from "../PopoverSelect";
import { BRANCH_FUNCTION_OPTIONS } from "./actionPopupConstants";

type BranchEditorProps = {
	branchId: string;
	value: string;
	draftVariables: string[];
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	serviceResources: ServiceResource[];
	onChange: (value: string) => void;
};

type ArgDropdownSlot = { slotId: string; options: PopoverOption[] };

function toResourceOptions(
	serviceResources: ServiceResource[],
	serviceId: string,
): PopoverOption[] {
	return serviceResources
		.filter((resource) => resource.fkServiceId === serviceId)
		.map((resource) => ({
			value: resource.id,
			label: displayLabel(resource.name),
		}))
		.sort((a, b) => a.label.localeCompare(b.label));
}

function buildArgDropdowns(
	functionName: ActionFunction | "",
	currentArgs: string[],
	draftVariables: string[],
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	serviceResources: ServiceResource[],
): ArgDropdownSlot[] {
	if (!functionName || functionName === "close" || functionName === "show") {
		return [];
	}

	if (functionName === "navigate") {
		const dropdowns: ArgDropdownSlot[] = [
			{ slotId: "navigate-flow", options: getFlowOptions(flowsById) },
		];

		const selectedFlowId = currentArgs[0];
		if (selectedFlowId) {
			dropdowns.push({
				slotId: "navigate-page",
				options: getPageOptions(flowsById, pagesById, selectedFlowId),
			});
		}
		return dropdowns;
	}

	if (functionName === "create") {
		const namespaceOptions: PopoverOption[] = [
			{ value: MARKETPLACE_SERVICE, label: "Marketplace" },
			{ value: EVY_CORE_SERVICE, label: "Evy" },
		];
		const dropdowns: ArgDropdownSlot[] = [
			{ slotId: "create-namespace", options: namespaceOptions },
		];
		if (currentArgs[0]) {
			dropdowns.push({
				slotId: "create-resource",
				options: toResourceOptions(serviceResources, currentArgs[0]),
			});
		}
		return dropdowns;
	}

	if (functionName === "highlight_required") {
		const varOptions = toVariableOptions(draftVariables, serviceResources);
		const dropdowns: ArgDropdownSlot[] = [
			{ slotId: "highlight-first", options: varOptions },
		];

		const filledCount = currentArgs.filter(Boolean).length;
		if (filledCount >= dropdowns.length) {
			dropdowns.push({ slotId: "highlight-second", options: varOptions });
		}
		return dropdowns;
	}

	return [];
}

export function BranchEditor({
	branchId,
	value,
	draftVariables,
	flowsById,
	pagesById,
	serviceResources,
	onChange,
}: BranchEditorProps) {
	const parsed = useMemo(() => parseBranch(value), [value]);
	const selectedFunction = parsed?.functionName ?? "";
	const args = parsed?.args ?? [];

	const handleFunctionChange = useCallback(
		(functionName: string) => {
			if (!functionName) {
				onChange("");
				return;
			}
			onChange(serializeBranch(functionName as ActionFunction, []));
		},
		[onChange],
	);

	const handleArgChange = useCallback(
		(argIndex: number, argValue: string) => {
			if (!selectedFunction) return;
			const trimmedArgValue = argValue.trim();
			if (
				selectedFunction === "navigate" &&
				argIndex === 2 &&
				trimmedArgValue &&
				!trimmedArgValue.startsWith("{")
			) {
				return;
			}
			const newArgs = [...args];
			while (newArgs.length <= argIndex) newArgs.push("");
			newArgs[argIndex] = argValue;
			onChange(
				serializeBranch(selectedFunction as ActionFunction, newArgs),
			);
		},
		[selectedFunction, args, onChange],
	);

	const argDropdowns = buildArgDropdowns(
		selectedFunction as ActionFunction | "",
		args,
		draftVariables,
		flowsById,
		pagesById,
		serviceResources,
	);

	return (
		<div className="evy-flex evy-flex-col evy-gap-1">
			<PopoverSelect
				ariaLabel={`${branchId}-function`}
				options={BRANCH_FUNCTION_OPTIONS}
				value={selectedFunction}
				onChange={handleFunctionChange}
			/>

			{argDropdowns.map((slot, argIndex) => (
				<PopoverSelect
					key={`${branchId}-${slot.slotId}`}
					ariaLabel={`${branchId}-arg-${argIndex}`}
					options={slot.options}
					value={args[argIndex] ?? ""}
					onChange={(v) => handleArgChange(argIndex, v)}
				/>
			))}

			{selectedFunction === "navigate" && args[0] && args[1] && (
				<textarea
					aria-label={`${branchId}-navigate-query`}
					value={args[2] ?? ""}
					onChange={(e) => handleArgChange(2, e.target.value)}
					placeholder="Optional query, e.g. {items: [$datum.id]}"
					rows={3}
					className="evy-action-popup-textarea"
				/>
			)}
		</div>
	);
}
