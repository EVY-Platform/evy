import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	RowTriggerName,
	UI_RowAction,
} from "evy-types";
import { Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { TRIGGER_LABELS } from "../rows/rowTriggers";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import {
	branchToEditableString,
	formatBranchDisplay,
	parseBranch,
} from "../utils/actionBranch";
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
	trigger: RowTriggerName;
	required: boolean;
	actions: UI_RowAction[];
	flowsById: Record<string, DATA_EVY_Flow>;
	pagesById: Record<string, DATA_EVY_Page>;
	rowsById: Record<string, DATA_EVY_Row>;
	defaultSheetRowId?: string;
	onUpdate: (actions: UI_RowAction[]) => void;
};

export function ActionEditor({
	trigger,
	required,
	actions,
	flowsById,
	pagesById,
	rowsById,
	defaultSheetRowId,
	onUpdate,
}: ActionEditorProps) {
	const { serviceResources, serviceNamesById } = useFlowsContext();
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const idCandidates = useMemo(
		() =>
			buildIdCandidates(
				flowsById,
				pagesById,
				serviceResources,
				serviceNamesById,
			),
		[flowsById, pagesById, serviceResources, serviceNamesById],
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

	const triggerLabel = TRIGGER_LABELS[trigger];

	return (
		<div>
			<div className="evy-flex evy-items-center evy-justify-between evy-mb-2">
				<div className="evy-flex evy-items-center evy-gap-2">
					<p className="evy-text-lg evy-font-semibold">
						{triggerLabel}
					</p>
					{required ? (
						<span className="evy-text-xs evy-font-normal evy-text-gray">
							(required)
						</span>
					) : null}
				</div>
				<button
					type="button"
					className="evy-text-sm evy-bg-transparent evy-border-none evy-rounded-sm evy-text-blue evy-cursor-pointer evy-hover:bg-gray-light"
					onClick={addAction}
				>
					Add action
				</button>
			</div>
			{required && actions.length === 0 ? (
				<p className="evy-text-sm evy-text-amber-700 evy-mb-2">
					This trigger needs at least one action.
				</p>
			) : null}
			{actions.length > 0 ? (
				<div className="evy-flex evy-flex-col evy-gap-4">
					{actions.map((action, index) => (
						<ActionSummaryCard
							key={`action-${action.condition}-${action.true}-${action.false}`}
							action={action}
							index={index}
							flowsById={flowsById}
							pagesById={pagesById}
							rowsById={rowsById}
							idCandidates={idCandidates}
							onEdit={() => setEditingIndex(index)}
							onRemove={() => removeAction(index)}
						/>
					))}
				</div>
			) : (
				<div className="evy-text-sm evy-text-gray">
					No {triggerLabel.toLowerCase()} actions
				</div>
			)}

			{editing && (
				<ActionPopup
					action={editing.action}
					actionIndex={editing.index}
					defaultSheetRowId={defaultSheetRowId}
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
	rowsById: Record<string, DATA_EVY_Row>;
	idCandidates: IdCandidate[];
	onEdit: () => void;
	onRemove: () => void;
};

function ActionSummaryCard({
	action,
	index,
	flowsById,
	pagesById,
	rowsById,
	idCandidates,
	onEdit,
	onRemove,
}: ActionSummaryCardProps) {
	const { serviceResources } = useFlowsContext();
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
						formatBranchDisplay(
							branchToEditableString(action.true),
							flowsById,
							pagesById,
							rowsById,
						),
						idCandidates,
					)
				: null,
		[trueBranch, action.true, flowsById, pagesById, rowsById, idCandidates],
	);
	const falseBranchDisplay = useMemo(
		() =>
			falseBranch
				? getIdDisplayText(
						formatBranchDisplay(
							branchToEditableString(action.false),
							flowsById,
							pagesById,
							rowsById,
						),
						idCandidates,
					)
				: null,
		[
			falseBranch,
			action.false,
			flowsById,
			pagesById,
			rowsById,
			idCandidates,
		],
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
