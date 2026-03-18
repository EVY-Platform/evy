import { useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { SDUI_RowAction } from "evy-types";

const popupCss = `
.evy-popup-overlay {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.3);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9000;
}
.evy-popup-panel {
	background: var(--color-white);
	border-radius: var(--radius-md);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	width: 500px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.evy-popup-header {
	padding: var(--spacing-4);
	border-bottom: 1px solid var(--color-gray-border);
}
.evy-popup-body {
	padding: var(--spacing-4);
	overflow-y: auto;
	flex: 1;
}
.evy-popup-footer {
	padding: var(--spacing-3) var(--spacing-4);
	border-top: 1px solid var(--color-gray-border);
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing-2);
}
.evy-popup-btn {
	font-size: var(--text-sm);
	font-family: inherit;
	padding: 6px 16px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--color-gray-border);
	cursor: pointer;
}
.evy-popup-btn-cancel {
	background: var(--color-white);
	color: var(--color-black);
}
.evy-popup-btn-cancel:hover {
	background: var(--color-evy-gray-light);
}
.evy-popup-btn-save {
	background: var(--color-black);
	color: var(--color-white);
	border-color: var(--color-black);
}
.evy-popup-btn-save:hover {
	opacity: 0.85;
}
`;

import { AppContext } from "../state";
import {
	COMPARISON_OPERATORS,
	OPERATOR_LABELS,
	ACTION_FUNCTIONS,
	FUNCTION_LABELS,
	CONDITION_FUNCTIONS,
	CONDITION_FUNCTION_LABELS,
	displayLabel,
	extractDraftVariables,
	parseCondition,
	serializeCondition,
	parseBranch,
	serializeBranch,
	parseOperand,
	serializeOperand,
	getDataModelNames,
	getFlowOptions,
	getPageOptions,
	type ConditionPart,
	type ActionFunction,
} from "../utils/actionHelpers";
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
	const { flows, activeFlowId } = useContext(AppContext);
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

	return createPortal(
		<>
			<style>{popupCss}</style>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: overlay click-to-dismiss is a standard modal pattern */}
			<div
				className="evy-popup-overlay"
				onClick={onCancel}
				onKeyDown={(e) => {
					if (e.key === "Escape") onCancel();
				}}
			>
				<div
					className="evy-popup-panel"
					onClick={(e) => e.stopPropagation()}
					onKeyDown={() => {}}
					role="dialog"
					aria-label={`Edit action ${actionIndex + 1}`}
				>
					<div className="evy-popup-header">
						<span className="evy-text-lg evy-font-semibold">
							Action {actionIndex + 1}
						</span>
					</div>

					<div className="evy-popup-body">
						<ConditionEditor
							conditions={conditions}
							draftVariables={draftVariables}
							onChange={setConditions}
							actionIndex={actionIndex}
						/>

						<BranchEditor
							label="If true"
							branchId={`true-${actionIndex}`}
							value={trueBranch}
							draftVariables={draftVariables}
							flows={flows}
							onChange={setTrueBranch}
						/>

						<BranchEditor
							label="If false"
							branchId={`false-${actionIndex}`}
							value={falseBranch}
							draftVariables={draftVariables}
							flows={flows}
							onChange={setFalseBranch}
						/>
					</div>

					<div className="evy-popup-footer">
						<button
							type="button"
							className="evy-popup-btn evy-popup-btn-cancel"
							onClick={onCancel}
						>
							Cancel
						</button>
						<button
							type="button"
							className="evy-popup-btn evy-popup-btn-save"
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

	const primaryOptions: PopoverOption[] = useMemo(() => {
		const values: PopoverOption[] = [
			{ value: "true", label: "true", separator: "Base" },
			{ value: "false", label: "false" },
		];
		const variables: PopoverOption[] = draftVariables.map((v, i) => ({
			value: v,
			label: displayLabel(v),
			...(i === 0 ? { separator: "Data" } : {}),
		}));
		const functions: PopoverOption[] = CONDITION_FUNCTIONS.map((fn, i) => ({
			value: `__fn__${fn}`,
			label: `${CONDITION_FUNCTION_LABELS[fn]}(...)`,
			...(i === 0 ? { separator: "Functions" } : {}),
		}));
		return [...values, ...variables, ...functions];
	}, [draftVariables]);

	const argOptions: PopoverOption[] = useMemo(
		() =>
			draftVariables.map((v) => ({
				value: v,
				label: displayLabel(v),
			})),
		[draftVariables],
	);

	const primaryValue = useMemo(() => {
		if (parsed.type === "function") return `__fn__${parsed.name}`;
		return parsed.value;
	}, [parsed]);

	const handlePrimaryChange = useCallback(
		(selected: string) => {
			if (selected.startsWith("__fn__")) {
				const fnName = selected.slice(6);
				onChange(`${fnName}()`);
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
			{parsed.type === "function" && (
				<PopoverSelect
					ariaLabel={`${ariaLabel}-arg`}
					options={argOptions}
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
	const addCondition = useCallback(() => {
		onChange([...conditions, { left: "", operator: "==", right: "" }]);
	}, [conditions, onChange]);

	const handleRowChange = useCallback(
		(rowIndex: number, field: "left" | "operator" | "right", value: string) => {
			const updated = conditions.map((c, i) => {
				if (i !== rowIndex) return c;
				return { ...c, [field]: value };
			});
			onChange(updated);
		},
		[conditions, onChange],
	);

	const handleRemoveCondition = useCallback(
		(rowIndex: number) => {
			onChange(conditions.filter((_, i) => i !== rowIndex));
		},
		[conditions, onChange],
	);

	return (
		<div className="evy-mb-2">
			<span className="evy-text-sm evy-font-medium evy-block evy-mb-1">
				Conditions (OR)
			</span>
			<div className="evy-flex evy-flex-col evy-gap-2">
				{conditions.length === 0 && (
					<span className="evy-text-sm evy-text-gray">No conditions</span>
				)}
				{conditions.map((row, rowIndex) => {
					const conditionRowId = `condition-${actionIndex}-${rowIndex}`;
					return (
						<div
							key={conditionRowId}
							className="evy-flex evy-items-start evy-gap-1"
						>
							<OperandEditor
								ariaLabel={`condition-${actionIndex}-${rowIndex}-left`}
								value={row.left}
								draftVariables={draftVariables}
								onChange={(v) => handleRowChange(rowIndex, "left", v)}
							/>

							<PopoverSelect
								ariaLabel={`condition-${actionIndex}-${rowIndex}-op`}
								options={OPERATOR_OPTIONS}
								value={row.operator}
								onChange={(v) => handleRowChange(rowIndex, "operator", v)}
							/>

							<OperandEditor
								ariaLabel={`condition-${actionIndex}-${rowIndex}-right`}
								value={row.right}
								draftVariables={draftVariables}
								onChange={(v) => handleRowChange(rowIndex, "right", v)}
							/>

							<button
								type="button"
								className="evy-text-sm evy-bg-transparent evy-border-none evy-cursor-pointer evy-text-gray"
								onClick={() => handleRemoveCondition(rowIndex)}
								aria-label={`Remove condition ${rowIndex + 1}`}
							>
								x
							</button>
						</div>
					);
				})}
				<button
					type="button"
					className="evy-text-sm evy-bg-transparent evy-border-none evy-cursor-pointer evy-text-blue"
					onClick={addCondition}
				>
					Add condition
				</button>
			</div>
		</div>
	);
}

type BranchEditorProps = {
	label: string;
	branchId: string;
	value: string;
	draftVariables: string[];
	flows: ReturnType<typeof useContext<typeof AppContext>>["flows"];
	onChange: (value: string) => void;
};

function BranchEditor({
	label,
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
		<div className="evy-mb-2">
			<span className="evy-text-sm evy-font-medium evy-block evy-mb-1">
				{label}
			</span>
			<div className="evy-flex evy-flex-col evy-gap-1">
				<PopoverSelect
					ariaLabel={`${branchId}-function`}
					options={FUNCTION_OPTIONS}
					value={selectedFunction}
					onChange={handleFunctionChange}
				/>

				{argDropdowns.map((dropdown, argIndex) => (
					<PopoverSelect
						key={`${branchId}-arg-${argIndex}-${dropdown.options.length}`}
						ariaLabel={`${branchId}-arg-${argIndex}`}
						options={dropdown.options}
						value={args[argIndex] ?? ""}
						onChange={(v) => handleArgChange(argIndex, v)}
					/>
				))}
			</div>
		</div>
	);
}

type DropdownConfig = {
	options: PopoverOption[];
};

function buildArgDropdowns(
	functionName: ActionFunction | "",
	currentArgs: string[],
	draftVariables: string[],
	flows: ReturnType<typeof useContext<typeof AppContext>>["flows"],
): DropdownConfig[] {
	if (!functionName || functionName === "close") return [];

	if (functionName === "navigate") {
		const flowOptions = getFlowOptions(flows).map((f) => ({
			value: f.id,
			label: f.label,
		}));
		const dropdowns: DropdownConfig[] = [{ options: flowOptions }];

		const selectedFlowId = currentArgs[0];
		if (selectedFlowId) {
			const pageOptions = getPageOptions(flows, selectedFlowId).map((p) => ({
				value: p.id,
				label: p.label,
			}));
			dropdowns.push({ options: pageOptions });
		}
		return dropdowns;
	}

	if (functionName === "create") {
		const dataNames = getDataModelNames(flows).map((name) => ({
			value: name,
			label: displayLabel(name),
		}));
		return [{ options: dataNames }];
	}

	if (functionName === "highlight_required") {
		const varOptions = draftVariables.map((v) => ({
			value: v,
			label: displayLabel(v),
		}));
		const dropdowns: DropdownConfig[] = [{ options: varOptions }];

		const filledCount = currentArgs.filter(Boolean).length;
		if (filledCount >= dropdowns.length) {
			dropdowns.push({ options: varOptions });
		}
		return dropdowns;
	}

	return [];
}
