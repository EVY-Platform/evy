import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import type { SDUI_RowAction } from "evy-types";

import type { SDUI_Flow } from "../types/flow";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { useFlowsContext } from "../state";
import { Plus } from "lucide-react";
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
	emptyLeaf,
	type ConditionExpression,
	type ConditionGroup,
	type ConditionLeaf,
	type LogicalOperator,
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
	const [expression, setExpression] = useState<ConditionExpression | null>(() =>
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
			condition: serializeCondition(expression),
			true: trueBranch,
			false: falseBranch,
		});
	}, [expression, trueBranch, falseBranch, onSave]);

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
						<div>
							<span className="evy-popup-section-title">Conditions</span>
							<ConditionGroupEditor
								expression={expression}
								draftVariables={draftVariables}
								onChange={setExpression}
								actionIndex={actionIndex}
								idPrefix={`condition-${actionIndex}`}
								isTopLevel
							/>
						</div>

						<div className="evy-popup-branches">
							<div>
								<span className="evy-popup-section-title">If true</span>
								<BranchEditor
									branchId={`true-${actionIndex}`}
									value={trueBranch}
									draftVariables={draftVariables}
									flows={flows}
									onChange={setTrueBranch}
								/>
							</div>

							<div>
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

type ConditionGroupEditorProps = {
	expression: ConditionExpression | null;
	draftVariables: string[];
	onChange: (expression: ConditionExpression | null) => void;
	actionIndex: number;
	idPrefix: string;
	isTopLevel?: boolean;
};

function ensureGroup(expr: ConditionExpression | null): ConditionGroup {
	if (!expr) {
		return { type: "group", logicalOperator: "or", children: [] };
	}
	if (expr.type === "group") return expr;
	return { type: "group", logicalOperator: "or", children: [expr] };
}

function normalizeExpression(
	group: ConditionGroup,
): ConditionExpression | null {
	if (group.children.length === 0) return null;
	if (group.children.length === 1) return group.children[0];
	return group;
}

function LogicalSegmentControl({
	value,
	onChange,
	testId,
}: {
	value: LogicalOperator;
	onChange: () => void;
	testId: string;
}) {
	return (
		<div className="evy-condition-logic-row">
			<div className="evy-segment-control" data-testid={testId}>
				<button
					type="button"
					className={
						value === "and"
							? "evy-segment-btn--active"
							: "evy-segment-btn--inactive"
					}
					onClick={value === "and" ? undefined : onChange}
				>
					AND
				</button>
				<button
					type="button"
					className={
						value === "or"
							? "evy-segment-btn--active"
							: "evy-segment-btn--inactive"
					}
					onClick={value === "or" ? undefined : onChange}
				>
					OR
				</button>
			</div>
		</div>
	);
}

function ConditionGroupEditor({
	expression,
	draftVariables,
	onChange,
	actionIndex,
	idPrefix,
	isTopLevel = false,
}: ConditionGroupEditorProps) {
	const group = useMemo(() => ensureGroup(expression), [expression]);

	const [draft, setDraft] = useState<ConditionLeaf>(emptyLeaf());

	const handleLogicalToggle = useCallback(() => {
		const next: LogicalOperator = group.logicalOperator === "or" ? "and" : "or";
		onChange(normalizeExpression({ ...group, logicalOperator: next }));
	}, [group, onChange]);

	const handleLeafChange = useCallback(
		(
			rowIndex: number,
			field: "left" | "operator" | "right",
			isPlaceholder: boolean,
			value: string,
		) => {
			if (isPlaceholder) {
				const updated: ConditionLeaf = { ...draft, [field]: value };
				if (!updated.left || !updated.operator || !updated.right) {
					setDraft(updated);
				} else {
					const newChildren = [...group.children, updated];
					onChange(normalizeExpression({ ...group, children: newChildren }));
					setDraft(emptyLeaf());
				}
			} else {
				const child = group.children[rowIndex];
				if (child.type !== "leaf") return;
				const updated: ConditionLeaf = { ...child, [field]: value };
				const newChildren = group.children.map((c, i) =>
					i === rowIndex ? updated : c,
				);
				onChange(normalizeExpression({ ...group, children: newChildren }));
			}
		},
		[draft, group, onChange],
	);

	const handleRemoveCondition = useCallback(
		(rowIndex: number) => {
			const newChildren = group.children.filter((_, i) => i !== rowIndex);
			onChange(normalizeExpression({ ...group, children: newChildren }));
		},
		[group, onChange],
	);

	const handleAddNestedGroup = useCallback(
		(rowIndex: number) => {
			const existingChild = group.children[rowIndex];
			if (existingChild.type === "leaf") {
				const nestedOp: LogicalOperator =
					group.logicalOperator === "and" ? "or" : "and";
				const nestedGroup: ConditionGroup = {
					type: "group",
					logicalOperator: nestedOp,
					children: [existingChild, emptyLeaf()],
				};
				const newChildren = group.children.map((c, i) =>
					i === rowIndex ? nestedGroup : c,
				);
				onChange(normalizeExpression({ ...group, children: newChildren }));
			}
		},
		[group, onChange],
	);

	const handleNestedGroupChange = useCallback(
		(rowIndex: number, nestedExpr: ConditionExpression | null) => {
			const newChildren = [...group.children];
			if (nestedExpr) {
				newChildren[rowIndex] = nestedExpr;
			} else {
				newChildren.splice(rowIndex, 1);
			}
			onChange(normalizeExpression({ ...group, children: newChildren }));
		},
		[group, onChange],
	);

	const leafRows: (ConditionLeaf | ConditionGroup)[] = [...group.children];

	return (
		<div
			className={`evy-flex evy-flex-col${isTopLevel ? "" : " evy-condition-nested-group"}`}
		>
			{leafRows.map((child, rowIndex) => {
				const rowId = `${idPrefix}-${rowIndex}`;

				if (child.type === "group") {
					return (
						<span key={rowId}>
							{rowIndex > 0 && (
								<LogicalSegmentControl
									value={group.logicalOperator}
									onChange={handleLogicalToggle}
									testId={`${idPrefix}-logical-toggle`}
								/>
							)}
							<ConditionGroupEditor
								expression={child}
								draftVariables={draftVariables}
								onChange={(nested) => handleNestedGroupChange(rowIndex, nested)}
								actionIndex={actionIndex}
								idPrefix={`${idPrefix}-${rowIndex}`}
							/>
						</span>
					);
				}

				return (
					<span key={rowId}>
						{rowIndex > 0 && (
							<LogicalSegmentControl
								value={group.logicalOperator}
								onChange={handleLogicalToggle}
								testId={`${idPrefix}-logical-toggle`}
							/>
						)}
						<div className="evy-condition-row">
							<OperandEditor
								ariaLabel={`${rowId}-left`}
								value={child.left}
								draftVariables={draftVariables}
								onChange={(v) => handleLeafChange(rowIndex, "left", false, v)}
							/>

							<PopoverSelect
								ariaLabel={`${rowId}-op`}
								options={OPERATOR_OPTIONS}
								value={child.operator}
								onChange={(v) =>
									handleLeafChange(rowIndex, "operator", false, v)
								}
							/>

							<OperandEditor
								ariaLabel={`${rowId}-right`}
								value={child.right}
								draftVariables={draftVariables}
								onChange={(v) => handleLeafChange(rowIndex, "right", false, v)}
							/>

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

							<button
								type="button"
								className="evy-condition-nest-btn evy-bg-transparent evy-border-none evy-cursor-pointer"
								onClick={() => handleAddNestedGroup(rowIndex)}
								aria-label={`Add nested group at condition ${rowIndex + 1}`}
								title="Add nested group"
							>
								<Plus
									className="evy-h-4 evy-w-4"
									strokeWidth={LUCIDE_STROKE_WIDTH}
									aria-hidden
								/>
							</button>
						</div>
					</span>
				);
			})}

			{/* Placeholder row for adding a new leaf */}
			<span>
				{leafRows.length > 0 && (
					<LogicalSegmentControl
						value={group.logicalOperator}
						onChange={handleLogicalToggle}
						testId={`${idPrefix}-logical-toggle`}
					/>
				)}
				<div className="evy-condition-row evy-condition-row--placeholder">
					<OperandEditor
						ariaLabel={`${idPrefix}-${leafRows.length}-left`}
						value={draft.left}
						draftVariables={draftVariables}
						onChange={(v) => handleLeafChange(leafRows.length, "left", true, v)}
					/>

					<PopoverSelect
						ariaLabel={`${idPrefix}-${leafRows.length}-op`}
						options={OPERATOR_OPTIONS}
						value={draft.operator}
						onChange={(v) =>
							handleLeafChange(leafRows.length, "operator", true, v)
						}
					/>

					<OperandEditor
						ariaLabel={`${idPrefix}-${leafRows.length}-right`}
						value={draft.right}
						draftVariables={draftVariables}
						onChange={(v) =>
							handleLeafChange(leafRows.length, "right", true, v)
						}
					/>
				</div>
			</span>
		</div>
	);
}

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
