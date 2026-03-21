import { useCallback, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { LUCIDE_STROKE_WIDTH } from "../../icons/iconSyntax";
import {
	emptyLeaf,
	type ConditionExpression,
	type ConditionGroup,
	type ConditionLeaf,
	type LogicalOperator,
} from "../../utils/actionHelpers";
import { PopoverSelect } from "../PopoverSelect";
import { OPERATOR_OPTIONS } from "./actionPopupConstants";
import {
	ensureGroup,
	normalizeExpression,
} from "./actionExpressionEditorHelpers";
import { LogicalSegmentControl } from "./LogicalSegmentControl";
import { OperandEditor } from "./OperandEditor";

export type ConditionGroupEditorProps = {
	expression: ConditionExpression | null;
	draftVariables: string[];
	onChange: (expression: ConditionExpression | null) => void;
	idPrefix: string;
	isTopLevel?: boolean;
};

export function ConditionGroupEditor({
	expression,
	draftVariables,
	onChange,
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
