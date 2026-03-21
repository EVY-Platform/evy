import { useCallback, useMemo } from "react";

import type { SDUI_Flow } from "../../types/flow";
import {
	type ActionFunction,
	getFlowOptions,
	getPageOptions,
	parseBranch,
	serializeBranch,
	toVariableOptions,
} from "../../utils/actionHelpers";
import { PopoverSelect, type PopoverOption } from "../PopoverSelect";
import { FUNCTION_OPTIONS } from "./actionPopupConstants";

type BranchEditorProps = {
	branchId: string;
	value: string;
	draftVariables: string[];
	flows: SDUI_Flow[];
	onChange: (value: string) => void;
};

type ArgDropdownSlot = { slotId: string; options: PopoverOption[] };

function buildArgDropdowns(
	functionName: ActionFunction | "",
	currentArgs: string[],
	draftVariables: string[],
	flows: SDUI_Flow[],
): ArgDropdownSlot[] {
	if (!functionName || functionName === "close") return [];

	if (functionName === "navigate") {
		const dropdowns: ArgDropdownSlot[] = [
			{ slotId: "navigate-flow", options: getFlowOptions(flows) },
		];

		const selectedFlowId = currentArgs[0];
		if (selectedFlowId) {
			dropdowns.push({
				slotId: "navigate-page",
				options: getPageOptions(flows, selectedFlowId),
			});
		}
		return dropdowns;
	}

	if (functionName === "create") {
		return [
			{ slotId: "create-variable", options: toVariableOptions(draftVariables) },
		];
	}

	if (functionName === "highlight_required") {
		const varOptions = toVariableOptions(draftVariables);
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
	flows,
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
			const newArgs = [...args];
			while (newArgs.length <= argIndex) newArgs.push("");
			newArgs[argIndex] = argValue;
			onChange(serializeBranch(selectedFunction as ActionFunction, newArgs));
		},
		[selectedFunction, args, onChange],
	);

	const argDropdowns = buildArgDropdowns(
		selectedFunction as ActionFunction | "",
		args,
		draftVariables,
		flows,
	);

	return (
		<div className="evy-flex evy-flex-col evy-gap-1">
			<PopoverSelect
				ariaLabel={`${branchId}-function`}
				options={FUNCTION_OPTIONS}
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
		</div>
	);
}
