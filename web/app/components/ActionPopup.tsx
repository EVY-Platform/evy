import type { UI_RowAction } from "evy-types";
import { useCallback, useMemo, useState } from "react";

import { useFlowsContext } from "../state/contexts/FlowsContext";
import {
	branchForStorage,
	branchToEditableString,
} from "../utils/actionBranch";
import {
	type ConditionExpression,
	parseCondition,
	serializeCondition,
} from "../utils/conditionExpression";
import {
	collectDraftSignals,
	finalizeBranchForSave,
} from "../utils/createDraftSignals";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	createGetAttributeCandidatesForQualifier,
} from "../utils/idCandidates";
import { BranchEditor } from "./actionPopup/BranchEditor";
import { ConditionGroupEditor } from "./actionPopup/ConditionGroupEditor";
import { FlowSettingsModal } from "./flowSettings/FlowSettingsModal";
import { Modal } from "./Modal";

type ActionPopupProps = {
	action: UI_RowAction;
	actionIndex: number;
	defaultSheetRowId?: string;
	onSave: (action: UI_RowAction) => void;
	onCancel: () => void;
};

export function ActionPopup({
	action,
	actionIndex,
	defaultSheetRowId,
	onSave,
	onCancel,
}: ActionPopupProps) {
	const {
		flowsById,
		pagesById,
		rowsById,
		activeFlowId,
		serviceResources,
		resourceAttributeMetadata,
		serviceNamesById,
	} = useFlowsContext();
	const [expression, setExpression] = useState<ConditionExpression | null>(
		() => parseCondition(action.condition),
	);
	const [trueBranch, setTrueBranch] = useState(() =>
		branchToEditableString(action.true),
	);
	const [falseBranch, setFalseBranch] = useState(() =>
		branchToEditableString(action.false),
	);
	const [flowSettingsOpen, setFlowSettingsOpen] = useState(false);

	const draftSignals = useMemo(
		() => collectDraftSignals(flowsById, pagesById, rowsById, activeFlowId),
		[flowsById, pagesById, rowsById, activeFlowId],
	);
	const { draftVariables, draftUpdateTargets, declaredSubmits } =
		draftSignals;

	const idCandidates = useMemo(
		() => [
			...buildIdCandidates(serviceResources, serviceNamesById),
			buildDatumCandidate(),
			...buildFunctionCandidates(),
		],
		[serviceResources, serviceNamesById],
	);

	const getAttributeCandidatesForQualifier = useMemo(
		() =>
			createGetAttributeCandidatesForQualifier({
				serviceResources,
				resourceAttributeMetadata,
			}),
		[serviceResources, resourceAttributeMetadata],
	);

	/**
	 * Both branches in their storable form, or null where one cannot be saved.
	 *
	 * One computation feeds both the save button's enabled state and the save
	 * itself, which previously ran the same conversion twice behind dependency
	 * lists that had to be kept in step.
	 */
	const finalized = useMemo(
		() => ({
			trueBranch: finalizeBranchForSave(trueBranch, declaredSubmits),
			falseBranch: finalizeBranchForSave(falseBranch, declaredSubmits),
		}),
		[trueBranch, falseBranch, declaredSubmits],
	);

	const canSave =
		finalized.trueBranch !== null && finalized.falseBranch !== null;

	const handleSave = useCallback(() => {
		if (finalized.trueBranch === null || finalized.falseBranch === null) {
			return;
		}
		// Conversion happens on save, never on load, so opening and cancelling
		// an action cannot rewrite the stored row.
		onSave({
			condition: serializeCondition(expression),
			true: branchForStorage(finalized.trueBranch),
			false: branchForStorage(finalized.falseBranch),
		});
	}, [expression, finalized, onSave]);

	return (
		<Modal
			onClose={onCancel}
			panelClassName="evy-modal-panel--action"
			label={`Edit action ${actionIndex + 1}`}
			escapeEnabled={!flowSettingsOpen}
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
						serviceResources={serviceResources}
						idCandidates={idCandidates}
						getAttributeCandidatesForQualifier={
							getAttributeCandidatesForQualifier
						}
						onChange={setExpression}
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
							flowsById={flowsById}
							pagesById={pagesById}
							serviceResources={serviceResources}
							idCandidates={idCandidates}
							rowsById={rowsById}
							defaultSheetRowId={defaultSheetRowId}
							draftUpdateTargets={draftUpdateTargets}
							declaredSubmits={declaredSubmits}
							getAttributeCandidatesForQualifier={
								getAttributeCandidatesForQualifier
							}
							onChange={setTrueBranch}
							onConfigureSubmits={() => setFlowSettingsOpen(true)}
						/>
					</div>

					<div>
						<span className="evy-popup-section-title">
							If false
						</span>
						<BranchEditor
							branchId={`false-${actionIndex}`}
							value={falseBranch}
							draftVariables={draftVariables}
							flowsById={flowsById}
							pagesById={pagesById}
							serviceResources={serviceResources}
							idCandidates={idCandidates}
							rowsById={rowsById}
							defaultSheetRowId={defaultSheetRowId}
							draftUpdateTargets={draftUpdateTargets}
							declaredSubmits={declaredSubmits}
							getAttributeCandidatesForQualifier={
								getAttributeCandidatesForQualifier
							}
							onChange={setFalseBranch}
							onConfigureSubmits={() => setFlowSettingsOpen(true)}
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
					disabled={!canSave}
				>
					Save
				</button>
			</div>
			{flowSettingsOpen && (
				<FlowSettingsModal
					mode="edit"
					onClose={() => setFlowSettingsOpen(false)}
				/>
			)}
		</Modal>
	);
}
