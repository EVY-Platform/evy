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
	width: 680px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.evy-popup-header {
	padding: var(--spacing-4) var(--spacing-4);
	border-bottom: 1px solid var(--color-gray-border);
}
.evy-popup-body {
	padding: var(--spacing-4);
	overflow-y: auto;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3);
}
.evy-popup-footer {
	padding: var(--spacing-3) var(--spacing-4);
	border-top: 1px solid var(--color-gray-border);
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing-2);
}
.evy-popup-btn {
	font-size: var(--text-md);
	font-family: inherit;
	padding: 8px 20px;
	border-radius: var(--radius-sm);
	border: 1px solid var(--color-gray-border);
	cursor: pointer;
	transition: all var(--transition);
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
.evy-popup-section {
	background: var(--color-evy-gray-light);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-md);
	padding: var(--spacing-3);
}
.evy-popup-section-title {
	font-size: var(--text-sm);
	font-weight: var(--font-semibold);
	color: var(--color-black);
	margin-bottom: var(--spacing-2);
	display: block;
}
.evy-popup-branches {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--spacing-3);
}
.evy-condition-row {
	display: grid;
	grid-template-columns: 1fr auto 1fr auto;
	gap: 6px;
	align-items: start;
}
.evy-condition-or {
	display: block;
	text-align: center;
	font-size: 0.625rem;
	font-weight: var(--font-semibold);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--color-evy-gray);
	padding: 2px 0;
}
.evy-condition-remove {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	background: transparent;
	border: none;
	border-radius: var(--radius-sm);
	cursor: pointer;
	opacity: 0.7;
	transition: all var(--transition);
	margin-top: 2px;
	filter: brightness(0) saturate(100%) invert(23%) sepia(95%) saturate(5000%) hue-rotate(355deg) brightness(88%) contrast(95%);
}
.evy-condition-remove:hover {
	opacity: 1;
	background: var(--color-white);
}
.evy-condition-remove img {
	width: 14px;
	height: 14px;
}
`;

import type { SDUI_Flow } from "../types/flow";
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
						<div className="evy-popup-section">
							<span className="evy-popup-section-title">Conditions (OR)</span>
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
	const [draft, setDraft] = useState<ConditionPart>({
		left: "",
		operator: "==",
		right: "",
	});

	const handleDraftChange = useCallback(
		(field: "left" | "operator" | "right", value: string) => {
			const updated = { ...draft, [field]: value };
			setDraft(updated);

			if (updated.left && updated.operator && updated.right) {
				onChange([...conditions, updated]);
				setDraft({ left: "", operator: "==", right: "" });
			}
		},
		[draft, conditions, onChange],
	);

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

	const rows = [...conditions, draft];

	return (
		<div className="evy-flex evy-flex-col evy-gap-2">
			{rows.map((row, rowIndex) => {
				const isPlaceholderRow = rowIndex === conditions.length;
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
									isPlaceholderRow
										? handleDraftChange("left", v)
										: handleRowChange(rowIndex, "left", v)
								}
							/>

							<PopoverSelect
								ariaLabel={`condition-${actionIndex}-${rowIndex}-op`}
								options={OPERATOR_OPTIONS}
								value={row.operator}
								onChange={(v) =>
									isPlaceholderRow
										? handleDraftChange("operator", v)
										: handleRowChange(rowIndex, "operator", v)
								}
							/>

							<OperandEditor
								ariaLabel={`condition-${actionIndex}-${rowIndex}-right`}
								value={row.right}
								draftVariables={draftVariables}
								onChange={(v) =>
									isPlaceholderRow
										? handleDraftChange("right", v)
										: handleRowChange(rowIndex, "right", v)
								}
							/>

							{!isPlaceholderRow && (
								<button
									type="button"
									className="evy-condition-remove"
									onClick={() => handleRemoveCondition(rowIndex)}
									aria-label={`Remove condition ${rowIndex + 1}`}
								>
									<img src="/bin.svg" alt="" />
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
	);
}

type DropdownConfig = {
	options: PopoverOption[];
};

function buildArgDropdowns(
	functionName: ActionFunction | "",
	currentArgs: string[],
	draftVariables: string[],
	flows: SDUI_Flow[],
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
