import { useCallback, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { SDUI_RowAction } from "evy-types";

const actionSummaryCss = `
.evy-action-summary {
	padding: var(--spacing-2);
	background-color: var(--color-evy-gray-light);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
}
.evy-action-summary-body {
	display: block;
	width: 100%;
	padding: var(--spacing-2);
	background: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	cursor: pointer;
	text-align: left;
	font-family: inherit;
	transition: border-color var(--transition);
}
.evy-action-summary-body:hover {
	border-color: var(--color-evy-gray);
}
.evy-action-summary-list {
	margin: 2px 0 0 0;
	padding-left: 16px;
	list-style: disc;
}
.evy-action-summary-list li {
	line-height: 1.4;
}
`;

import type { SDUI_Flow } from "../types/flow";
import {
	parseCondition,
	parseBranch,
	formatConditionDisplay,
	formatBranchDisplay,
} from "../utils/actionHelpers";
import { ActionPopup } from "./ActionPopup";

type ActionEditorProps = {
	actions: SDUI_RowAction[];
	flows: SDUI_Flow[];
	onUpdate: (actions: SDUI_RowAction[]) => void;
};

export function ActionEditor({ actions, flows, onUpdate }: ActionEditorProps) {
	const [editingIndex, setEditingIndex] = useState<number | null>(null);

	const updateAction = useCallback(
		(index: number, updated: SDUI_RowAction) => {
			onUpdate(actions.map((a, i) => (i === index ? updated : a)));
		},
		[actions, onUpdate],
	);

	const removeAction = useCallback(
		(index: number) => {
			onUpdate(actions.filter((_, i) => i !== index));
		},
		[actions, onUpdate],
	);

	const addAction = useCallback(() => {
		const newIndex = actions.length;
		onUpdate([...actions, { condition: "", false: "", true: "" }]);
		setEditingIndex(newIndex);
	}, [actions, onUpdate]);

	const handlePopupSave = useCallback(
		(updated: SDUI_RowAction) => {
			if (editingIndex !== null) {
				updateAction(editingIndex, updated);
			}
			setEditingIndex(null);
		},
		[editingIndex, updateAction],
	);

	const handlePopupCancel = useCallback(() => {
		setEditingIndex(null);
	}, []);

	const editing =
		editingIndex !== null && actions[editingIndex]
			? { action: actions[editingIndex], index: editingIndex }
			: undefined;

	return (
		<div>
			<style>{actionSummaryCss}</style>
			<div className="evy-flex evy-items-center evy-justify-between evy-mb-4">
				<p className="evy-text-lg evy-font-semibold">Actions</p>
				<button
					type="button"
					className="evy-text-sm evy-bg-transparent evy-border-none evy-rounded-sm evy-text-blue evy-cursor-pointer evy-hover:bg-gray-light"
					onClick={addAction}
				>
					Add action
				</button>
			</div>
			{actions.length > 0 ? (
				<div className="evy-flex evy-flex-col evy-gap-4">
					{actions.map((action, index) => (
						<ActionSummaryCard
							key={`action-${action.condition}-${action.true}-${action.false}-${index}`}
							action={action}
							index={index}
							flows={flows}
							onEdit={() => setEditingIndex(index)}
							onRemove={() => removeAction(index)}
						/>
					))}
				</div>
			) : (
				<div className="evy-text-sm evy-text-gray">Row has no actions</div>
			)}

			{editing && (
				<ActionPopup
					action={editing.action}
					actionIndex={editing.index}
					onSave={handlePopupSave}
					onCancel={handlePopupCancel}
				/>
			)}
		</div>
	);
}

type ActionSummaryCardProps = {
	action: SDUI_RowAction;
	index: number;
	flows: SDUI_Flow[];
	onEdit: () => void;
	onRemove: () => void;
};

function ActionSummaryCard({
	action,
	index,
	flows,
	onEdit,
	onRemove,
}: ActionSummaryCardProps) {
	const conditions = useMemo(
		() => parseCondition(action.condition),
		[action.condition],
	);
	const trueBranch = useMemo(() => parseBranch(action.true), [action.true]);
	const falseBranch = useMemo(() => parseBranch(action.false), [action.false]);

	return (
		<div className="evy-action-summary">
			<div className="evy-flex evy-items-center evy-justify-between evy-mb-2">
				<span className="evy-text-sm evy-font-semibold">
					Action {index + 1}
				</span>
				<button
					type="button"
					className="evy-bin-button evy-bg-transparent evy-border-none evy-cursor-pointer"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					aria-label={`Remove action ${index + 1}`}
				>
					<Trash2 className="evy-h-4 evy-w-4" strokeWidth={2} aria-hidden />
				</button>
			</div>

			<button
				type="button"
				className="evy-action-summary-body"
				onClick={onEdit}
				aria-label={`Edit action ${index + 1}`}
			>
				{conditions.length > 0 && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							Conditions (OR):
						</span>
						<ul className="evy-action-summary-list">
							{conditions.map((cond) => (
								<li
									key={`${cond.left}-${cond.operator}-${cond.right}`}
									className="evy-text-sm"
								>
									{formatConditionDisplay(cond)}
								</li>
							))}
						</ul>
					</div>
				)}

				{trueBranch && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							If true:
						</span>
						<ul className="evy-action-summary-list">
							<li className="evy-text-sm">
								{formatBranchDisplay(action.true, flows)}
							</li>
						</ul>
					</div>
				)}

				{falseBranch && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							If false:
						</span>
						<ul className="evy-action-summary-list">
							<li className="evy-text-sm">
								{formatBranchDisplay(action.false, flows)}
							</li>
						</ul>
					</div>
				)}

				{conditions.length === 0 && !trueBranch && !falseBranch && (
					<span className="evy-text-sm evy-text-gray">
						Click to configure...
					</span>
				)}
			</button>
		</div>
	);
}
