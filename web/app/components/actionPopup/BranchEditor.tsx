import type { DATA_EVY_Flow, DATA_EVY_Page, DATA_EVY_Row } from "evy-types";
import { useCallback, useMemo } from "react";
import type { ServiceResource } from "../../types/resources";
import {
	type ActionFunction,
	createHasInlineDataArg,
	parseBranchText,
	ROW_ID_ARG_FUNCTIONS,
	serializeBranch,
	updateUsesDraftMarker,
	ZERO_ARG_FUNCTIONS,
} from "../../utils/actionBranch";
import {
	getAllRowOptions,
	getFlowOptions,
	getPageOptions,
	toVariableOptions,
} from "../../utils/actionFlowOptions";
import { shouldOfferCreateSubmitWithFlow } from "../../utils/createDraftSignals";
import type { IdCandidate } from "../../utils/idCandidates";
import {
	toResourceOptions,
	toServiceOptions,
} from "../../utils/serviceResourceOptions";
import { BuilderAssist } from "../BuilderAssist";
import { type PopoverOption, PopoverSelect } from "../PopoverSelect";
import { BRANCH_FUNCTION_OPTIONS } from "./actionPopupConstants";

type BranchEditorProps = {
	branchId: string;
	value: string;
	draftVariables: string[];
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	serviceResources: ServiceResource[];
	serviceNamesById: Map<string, string>;
	idCandidates: IdCandidate[];
	rowsById: Record<string, DATA_EVY_Row>;
	defaultSheetRowId?: string;
	draftUpdateTargets: Set<string>;
	declaredSubmits?: string | null;
	getAttributeCandidatesForQualifier: (qualifier: string) => IdCandidate[];
	onChange: (value: string) => void;
};

type ArgDropdownSlot = { slotId: string; options: PopoverOption[] };

function buildArgDropdowns(
	functionName: ActionFunction | "",
	currentArgs: string[],
	draftVariables: string[],
	flowsById: Record<string, DATA_EVY_Flow>,
	pagesById: Record<string, DATA_EVY_Page>,
	serviceResources: ServiceResource[],
	serviceNamesById: Map<string, string>,
	rowsById: Record<string, DATA_EVY_Row>,
): ArgDropdownSlot[] {
	if (!functionName) {
		return [];
	}

	if (ROW_ID_ARG_FUNCTIONS.has(functionName)) {
		return [
			{
				slotId: `${functionName}-row`,
				options: getAllRowOptions(flowsById, pagesById, rowsById),
			},
		];
	}

	if (ZERO_ARG_FUNCTIONS.has(functionName)) {
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

	if (functionName === "create" || functionName === "update") {
		const dropdowns: ArgDropdownSlot[] = [
			{
				slotId: `${functionName}-namespace`,
				options: toServiceOptions(serviceNamesById),
			},
		];
		if (currentArgs[0]) {
			dropdowns.push({
				slotId: `${functionName}-resource`,
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
	serviceNamesById,
	idCandidates,
	rowsById,
	defaultSheetRowId,
	draftUpdateTargets: _draftUpdateTargets,
	declaredSubmits = null,
	getAttributeCandidatesForQualifier,
	onChange,
}: BranchEditorProps) {
	const parsed = useMemo(() => parseBranchText(value), [value]);
	const selectedFunction = parsed?.functionName ?? "";
	const args = parsed?.args ?? [];

	const handleFunctionChange = useCallback(
		(functionName: string) => {
			if (!functionName) {
				onChange("");
				return;
			}
			if (functionName === "show" && defaultSheetRowId) {
				onChange(serializeBranch("show", [defaultSheetRowId]));
				return;
			}
			if (functionName === "select") {
				onChange(serializeBranch("select", ["$datum"]));
				return;
			}
			onChange(serializeBranch(functionName as ActionFunction, []));
		},
		[defaultSheetRowId, onChange],
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

	const offerSubmitCreate = useMemo(() => {
		if (selectedFunction !== "create") return false;
		const serviceId = args[0]?.trim() ?? "";
		const resourceId = args[1]?.trim() ?? "";
		return shouldOfferCreateSubmitWithFlow(
			serviceId,
			resourceId,
			declaredSubmits,
		);
	}, [selectedFunction, args, declaredSubmits]);

	const showSubmitCreateHint =
		offerSubmitCreate && !createHasInlineDataArg(args);
	const updateUsesDraftMode = updateUsesDraftMarker(args);

	const applyArgUpdates = useCallback(
		(updates: Array<[number, string]>) => {
			if (!selectedFunction) return;
			const newArgs = [...args];
			for (const [argIndex, argValue] of updates) {
				while (newArgs.length <= argIndex) newArgs.push("");
				newArgs[argIndex] = argValue;
			}
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
		serviceNamesById,
		rowsById,
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
				<BuilderAssist
					ariaLabel={`${branchId}-navigate-query`}
					value={args[2] ?? ""}
					onChange={(v) => handleArgChange(2, v)}
					candidates={idCandidates}
					getAttributeCandidatesForQualifier={
						getAttributeCandidatesForQualifier
					}
					placeholder="Optional query, e.g. {items: [$datum.id]}"
					multiline
				/>
			)}

			{selectedFunction === "create" &&
				args[0] &&
				args[1] &&
				(showSubmitCreateHint ? (
					<p className="evy-create-draft-hint">
						Creates from row destinations and draft updates
					</p>
				) : (
					<>
						<BuilderAssist
							ariaLabel={`${branchId}-create-data`}
							value={args[2] ?? ""}
							onChange={(v) => handleArgChange(2, v)}
							candidates={idCandidates}
							getAttributeCandidatesForQualifier={
								getAttributeCandidatesForQualifier
							}
							placeholder="Data path or inline object, e.g. pickup_address"
						/>
						<BuilderAssist
							ariaLabel={`${branchId}-create-id-destination`}
							value={args[3] ?? ""}
							onChange={(v) => handleArgChange(3, v)}
							candidates={idCandidates}
							getAttributeCandidatesForQualifier={
								getAttributeCandidatesForQualifier
							}
							placeholder="Optional id destination, e.g. {item.transfer_options.pickup.address_id}"
						/>
					</>
				))}

			{selectedFunction === "select" && (
				<BuilderAssist
					ariaLabel={`${branchId}-select-value`}
					value={args[0] ?? "$datum"}
					onChange={(v) => handleArgChange(0, v)}
					candidates={idCandidates}
					getAttributeCandidatesForQualifier={
						getAttributeCandidatesForQualifier
					}
					placeholder="Value, e.g. $datum"
				/>
			)}

			{selectedFunction === "update" && args[0] && args[1] && (
				<>
					<PopoverSelect
						ariaLabel={`${branchId}-update-mode`}
						options={[
							{
								value: "store",
								label: "Update matching records",
							},
							{
								value: "draft",
								label: "Write into create draft",
							},
						]}
						value={updateUsesDraftMode ? "draft" : "store"}
						onChange={(mode) => {
							if (mode === "draft") {
								applyArgUpdates([
									[2, "{}"],
									[4, "draft"],
								]);
							} else {
								applyArgUpdates([
									[2, ""],
									[4, ""],
								]);
							}
						}}
					/>
					{!updateUsesDraftMode && (
						<BuilderAssist
							ariaLabel={`${branchId}-update-filter`}
							value={args[2] ?? ""}
							onChange={(v) => handleArgChange(2, v)}
							candidates={idCandidates}
							getAttributeCandidatesForQualifier={
								getAttributeCandidatesForQualifier
							}
							placeholder="Filter, e.g. {fk: $datum.id, closedAt: null}"
							multiline
						/>
					)}
					<BuilderAssist
						ariaLabel={`${branchId}-update-changes`}
						value={args[3] ?? ""}
						onChange={(v) => handleArgChange(3, v)}
						candidates={idCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						placeholder="Changes, e.g. {closedAt: now()}"
						multiline
					/>
				</>
			)}
		</div>
	);
}
