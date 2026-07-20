import type { DATA_EVY_Flow, DATA_EVY_Page, UI_RowAction } from "evy-types";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import type { ServiceResource } from "../types/resources";
import { formatBranchDisplay, parseBranch } from "../utils/actionBranch";
import {
	formatExpressionSummary,
	parseCondition,
} from "../utils/conditionExpression";
import {
	buildIdCandidates,
	getIdDisplayText,
	type IdCandidate,
} from "../utils/idCandidates";
import { ActionPopup } from "./ActionPopup";

type ActionEditorProps = {
	actions: UI_RowAction[];
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	serviceResources: ServiceResource[];
	onUpdate: (actions: UI_RowAction[]) => void;
};

export function ActionEditor({
	actions,
	flowsById,
	pagesById,
	serviceResources,
	onUpdate,
}: ActionEditorProps) {
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const idCandidates = useMemo(
		() => buildIdCandidates(flowsById, pagesById, serviceResources),
		[flowsById, pagesById, serviceResources],
	);

	const updateAction = useCallback(
		(index: number, updated: UI_RowAction) => {
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
		(updated: UI_RowAction) => {
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
							key={`action-${action.condition}-${action.true}-${action.false}`}
							action={action}
							index={index}
							flowsById={flowsById}
							pagesById={pagesById}
							serviceResources={serviceResources}
							idCandidates={idCandidates}
							onEdit={() => setEditingIndex(index)}
							onRemove={() => removeAction(index)}
						/>
					))}
				</div>
			) : (
				<div className="evy-text-sm evy-text-gray">
					Row has no actions
				</div>
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
	action: UI_RowAction;
	index: number;
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	serviceResources: ServiceResource[];
	idCandidates: IdCandidate[];
	onEdit: () => void;
	onRemove: () => void;
};

function ActionSummaryCard({
	action,
	index,
	flowsById,
	pagesById,
	serviceResources,
	idCandidates,
	onEdit,
	onRemove,
}: ActionSummaryCardProps) {
	const conditionExpr = useMemo(
		() => parseCondition(action.condition),
		[action.condition],
	);
	const summaryLines = useMemo(
		() =>
			formatExpressionSummary(conditionExpr, serviceResources).map(
				(line) => ({
					...line,
					text: getIdDisplayText(line.text, idCandidates),
				}),
			),
		[conditionExpr, serviceResources, idCandidates],
	);
	const trueBranch = useMemo(() => parseBranch(action.true), [action.true]);
	const falseBranch = useMemo(
		() => parseBranch(action.false),
		[action.false],
	);
	const trueBranchDisplay = useMemo(
		() =>
			trueBranch
				? getIdDisplayText(
						formatBranchDisplay(action.true, flowsById, pagesById),
						idCandidates,
					)
				: null,
		[trueBranch, action.true, flowsById, pagesById, idCandidates],
	);
	const falseBranchDisplay = useMemo(
		() =>
			falseBranch
				? getIdDisplayText(
						formatBranchDisplay(action.false, flowsById, pagesById),
						idCandidates,
					)
				: null,
		[falseBranch, action.false, flowsById, pagesById, idCandidates],
	);

	return (
		<div>
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
					<Trash2
						className="evy-h-4 evy-w-4"
						strokeWidth={LUCIDE_STROKE_WIDTH}
						aria-hidden
					/>
				</button>
			</div>

			<button
				type="button"
				className="evy-action-summary-body"
				onClick={onEdit}
				aria-label={`Edit action ${index + 1}`}
			>
				{summaryLines.length > 0 && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							Conditions
						</span>
						<ul className="evy-action-summary-list">
							{summaryLines.map((line) => (
								<li
									key={`${line.prefix}-${line.text}`}
									className="evy-text-sm"
								>
									{line.prefix ? `${line.prefix} ` : ""}
									{line.text}
								</li>
							))}
						</ul>
					</div>
				)}

				{trueBranch && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							If true
						</span>
						<ul className="evy-action-summary-list">
							<li className="evy-text-sm">{trueBranchDisplay}</li>
						</ul>
					</div>
				)}

				{falseBranch && (
					<div className="evy-mb-1">
						<span className="evy-text-sm evy-font-medium evy-text-gray">
							If false
						</span>
						<ul className="evy-action-summary-list">
							<li className="evy-text-sm">
								{falseBranchDisplay}
							</li>
						</ul>
					</div>
				)}

				{summaryLines.length === 0 && !trueBranch && !falseBranch && (
					<span className="evy-text-sm evy-text-gray">
						Click to configure...
					</span>
				)}
			</button>
		</div>
	);
}
