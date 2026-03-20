import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import type { SDUI_RowAction } from "evy-types";

import type { SDUI_Flow } from "../types/flow";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useFlowsContext } from "../state";
import {
	COMPARISON_OPERATORS,
	OPERATOR_LABELS,
	ACTION_FUNCTIONS,
	FUNCTION_LABELS,
	CONDITION_FUNCTIONS,
	extractDraftVariables,
	parseCondition,
	serializeCondition,
	parseBranch,
	serializeBranch,
	parseOperand,
	serializeOperand,
	getFlowOptions,
	getPageOptions,
	toVariableOptions,
	type ConditionPart,
	type ActionFunction,
} from "../utils/actionHelpers";
import { actionPopupEditorCss } from "./actionPopupEditorCss";
import { modalSharedCss } from "./modalSharedCss";
import { PopoverSelect, type PopoverOption } from "./PopoverSelect";

type ActionPopupProps = {
	action: SDUI_RowAction;
	actionIndex: number;
	onSave: (action: SDUI_RowAction) => void;
	onCancel: () => void;
};

export function ActionPopup({
	action,
	actionIndex,
	onSave,
	onCancel,
}: ActionPopupProps) {
	const { flows, activeFlowId } = useFlowsContext();
	const [conditions, setConditions] = useState<ConditionPart[]>(() =>
		parseCondition(action.condition),
	);
	const [trueBranch, setTrueBranch] = useState(action.true);
	const [falseBranch, setFalseBranch] = useState(action.false);

	const draftVariables = useMemo(
		() => extractDraftVariables(flows, activeFlowId),
		[flows, activeFlowId],
	);

	const handleSave = useCallback(() => {
		onSave({
			condition: serializeCondition(conditions),
			true: trueBranch,
			false: falseBranch,
		});
	}, [conditions, trueBranch, falseBranch, onSave]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onCancel();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onCancel]);

	return createPortal(
		<>
			<style>{`${modalSharedCss}\n${actionPopupEditorCss}`}</style>
			<div className="evy-modal-root">
				<button
					type="button"
					className="evy-modal-backdrop"
					aria-label="Close dialog"
					onClick={onCancel}
				/>
				<div
					className="evy-modal-panel evy-modal-panel--action"
					role="dialog"
					aria-label={`Edit action ${actionIndex + 1}`}
				>
					<div className="evy-popup-header">
						<span className="evy-text-lg evy-font-semibold">
							Action {actionIndex + 1}
						</span>
					</div>

					<div className="evy-popup-body">
						<div className="evy-popup-section">
							<span className="evy-popup-section-title">Conditions</span>
							<ConditionEditor
								conditions={conditions}
								draftVariables={draftVariables}
								onChange={setConditions}
								actionIndex={actionIndex}
							/>
						</div>

						<div className="evy-popup-branches">
							<div className="evy-popup-section">
								<span className="evy-popup-section-title">If true</span>
								<BranchEditor
									branchId={`true-${actionIndex}`}
									value={trueBranch}
									draftVariables={draftVariables}
									flows={flows}
									onChange={setTrueBranch}
								/>
							</div>

							<div className="evy-popup-section">
								<span className="evy-popup-section-title">If false</span>
								<BranchEditor
									branchId={`false-${actionIndex}`}
									value={falseBranch}
									draftVariables={draftVariables}
									flows={flows}
									onChange={setFalseBranch}
								/>
							</div>
						</div>
					</div>

					<div className="evy-modal-footer">
						<button
							type="button"
							className="evy-modal-btn evy-modal-btn--md evy-modal-btn-cancel"
							onClick={onCancel}
						>
							Cancel
						</button>
						<button
							type="button"
							className="evy-modal-btn evy-modal-btn--md evy-modal-btn-primary"
							onClick={handleSave}
						>
							Save
						</button>
					</div>
				</div>
			</div>
		</>,
		document.body,
	);
}

const OPERATOR_OPTIONS: PopoverOption[] = COMPARISON_OPERATORS.map((op) => ({
	value: op,
	label: OPERATOR_LABELS[op],
}));

const FUNCTION_OPTIONS: PopoverOption[] = ACTION_FUNCTIONS.map((fn) => ({
	value: fn,
	label: FUNCTION_LABELS[fn],
}));

const BOOLEAN_OPTIONS: PopoverOption[] = [
	{ value: "true", label: "true" },
	{ value: "false", label: "false" },
];

type ConditionEditorProps = {
	conditions: ConditionPart[];
	draftVariables: string[];
	onChange: (conditions: ConditionPart[]) => void;
	actionIndex: number;
};

function OperandEditor({
	ariaLabel,
	value,
	draftVariables,
	onChange,
}: {
	ariaLabel: string;
	value: string;
	draftVariables: string[];
	onChange: (value: string) => void;
}) {
	const parsed = useMemo(() => parseOperand(value), [value]);

	const variableOptions: PopoverOption[] = useMemo(
		() => toVariableOptions(draftVariables),
		[draftVariables],
	);

	const primaryOptions: PopoverOption[] = useMemo(() => {
		const values: PopoverOption[] = [
			{ value: "__boolean__", label: "boolean", separator: "Base" },
			{ value: "__number__", label: "number" },
		];
		const variables: PopoverOption[] = variableOptions.map((opt, i) =>
			i === 0 ? { ...opt, separator: "Data" } : opt,
		);
		const functions: PopoverOption[] = CONDITION_FUNCTIONS.map((fn, i) => ({
			value: `__fn__${fn}`,
			label: `${fn}(...)`,
			...(i === 0 ? { separator: "Functions" } : {}),
		}));
		return [...values, ...variables, ...functions];
	}, [variableOptions]);

	const isBooleanValue =
		parsed.type === "value" &&
		(parsed.value === "true" || parsed.value === "false");

	const isNumericValue =
		parsed.type === "value" &&
		parsed.value !== "" &&
		!isBooleanValue &&
		Number.isFinite(Number(parsed.value));

	const primaryValue = useMemo(() => {
		if (parsed.type === "function") return `__fn__${parsed.name}`;
		if (isBooleanValue) return "__boolean__";
		if (isNumericValue) return "__number__";
		return parsed.value;
	}, [parsed, isBooleanValue, isNumericValue]);

	const handlePrimaryChange = useCallback(
		(selected: string) => {
			if (selected.startsWith("__fn__")) {
				const fnName = selected.slice(6);
				onChange(`${fnName}()`);
			} else if (selected === "__boolean__") {
				onChange("true");
			} else if (selected === "__number__") {
				onChange("0");
			} else {
				onChange(selected);
			}
		},
		[onChange],
	);

	const handleArgChange = useCallback(
		(arg: string) => {
			if (parsed.type !== "function") return;
			onChange(serializeOperand({ ...parsed, arg }));
		},
		[parsed, onChange],
	);

	return (
		<div className="evy-flex evy-flex-col evy-gap-1 evy-flex-1">
			<PopoverSelect
				ariaLabel={ariaLabel}
				options={primaryOptions}
				value={primaryValue}
				onChange={handlePrimaryChange}
			/>
			{isBooleanValue && (
				<PopoverSelect
					ariaLabel={`${ariaLabel}-boolean`}
					options={BOOLEAN_OPTIONS}
					value={parsed.value}
					onChange={onChange}
				/>
			)}
			{isNumericValue && (
				<input
					type="number"
					step="any"
					aria-label={`${ariaLabel}-number`}
					value={parsed.value}
					onChange={(e) => onChange(e.target.value)}
					className="evy-w-full evy-box-sizing-border evy-text-sm evy-rounded-sm evy-p-2 evy-border evy-border-gray-light evy-focus-visible:outline-none"
				/>
			)}
			{parsed.type === "function" && (
				<PopoverSelect
					ariaLabel={`${ariaLabel}-arg`}
					options={variableOptions}
					value={parsed.arg}
					onChange={handleArgChange}
					placeholder="argument..."
				/>
			)}
		</div>
	);
}

function ConditionEditor({
	conditions,
	draftVariables,
	onChange,
	actionIndex,
}: ConditionEditorProps) {
	const [draft, setDraft] = useState<ConditionPart>({
		left: "",
		operator: "==",
		right: "",
	});

	const handleFieldChange = useCallback(
		({
			rowIndex,
			field,
			isPlaceholder,
			value,
		}: {
			rowIndex: number;
			field: "left" | "operator" | "right";
			isPlaceholder: boolean;
			value: string;
		}) => {
			if (isPlaceholder) {
				const updated = { ...draft, [field]: value };
				if (!updated.left || !updated.operator || !updated.right) {
					setDraft(updated);
				} else {
					onChange([...conditions, updated]);
					setDraft({ left: "", operator: "==", right: "" });
				}
			} else {
				onChange(
					conditions.map((c, i) =>
						i === rowIndex ? { ...c, [field]: value } : c,
					),
				);
			}
		},
		[draft, conditions, onChange],
	);

	const handleRemoveCondition = useCallback(
		(rowIndex: number) => {
			onChange(conditions.filter((_, i) => i !== rowIndex));
		},
		[conditions, onChange],
	);

	const rows = [...conditions, draft];

	return (
		<div className="evy-flex evy-flex-col evy-gap-2">
			{rows.map((row, rowIndex) => {
				const isPlaceholder = rowIndex === conditions.length;
				const conditionRowId = `condition-${actionIndex}-${rowIndex}`;
				return (
					<span key={conditionRowId}>
						{rowIndex > 0 && <span className="evy-condition-or">OR</span>}
						<div className="evy-condition-row">
							<OperandEditor
								ariaLabel={`condition-${actionIndex}-${rowIndex}-left`}
								value={row.left}
								draftVariables={draftVariables}
								onChange={(v) =>
									handleFieldChange({
										rowIndex,
										field: "left",
										isPlaceholder,
										value: v,
									})
								}
							/>

							<PopoverSelect
								ariaLabel={`condition-${actionIndex}-${rowIndex}-op`}
								options={OPERATOR_OPTIONS}
								value={row.operator}
								onChange={(v) =>
									handleFieldChange({
										rowIndex,
										field: "operator",
										isPlaceholder,
										value: v,
									})
								}
							/>

							<OperandEditor
								ariaLabel={`condition-${actionIndex}-${rowIndex}-right`}
								value={row.right}
								draftVariables={draftVariables}
								onChange={(v) =>
									handleFieldChange({
										rowIndex,
										field: "right",
										isPlaceholder,
										value: v,
									})
								}
							/>

							{!isPlaceholder && (
								<button
									type="button"
									className="evy-bin-button evy-condition-remove evy-bg-transparent evy-border-none evy-cursor-pointer"
									onClick={() => handleRemoveCondition(rowIndex)}
									aria-label={`Remove condition ${rowIndex + 1}`}
								>
									<Trash2
										className="evy-h-4 evy-w-4"
										strokeWidth={LUCIDE_STROKE_WIDTH}
										aria-hidden
									/>
								</button>
							)}
						</div>
					</span>
				);
			})}
		</div>
	);
}

type BranchEditorProps = {
	branchId: string;
	value: string;
	draftVariables: string[];
	flows: SDUI_Flow[];
	onChange: (value: string) => void;
};

function BranchEditor({
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
