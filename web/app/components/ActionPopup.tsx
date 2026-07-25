import type { UI_RowAction } from "evy-types";
import { useCallback, useMemo, useState } from "react";

import { useFlowsContext } from "../state/contexts/FlowsContext";
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
	} = useFlowsContext();
	const [expression, setExpression] = useState<ConditionExpression | null>(
		() => parseCondition(action.condition),
	);
	const [trueBranch, setTrueBranch] = useState(action.true);
	const [falseBranch, setFalseBranch] = useState(action.false);

	const draftSignals = useMemo(
		() => collectDraftSignals(flowsById, pagesById, rowsById, activeFlowId),
		[flowsById, pagesById, rowsById, activeFlowId],
	);
	const { draftVariables, draftUpdateTargets, declaredSubmits } =
		draftSignals;

	const idCandidates = useMemo(
		() => [
			...buildIdCandidates(flowsById, pagesById, serviceResources),
			buildDatumCandidate(),
			...buildFunctionCandidates(),
		],
		[flowsById, pagesById, serviceResources],
	);

	const getAttributeCandidatesForQualifier = useMemo(
		() =>
			createGetAttributeCandidatesForQualifier({
				serviceResources,
				resourceAttributeMetadata,
			}),
		[serviceResources, resourceAttributeMetadata],
	);

	const canSave = useMemo(() => {
		const finalizedTrue = finalizeBranchForSave(
			trueBranch,
			draftVariables,
			draftUpdateTargets,
			declaredSubmits,
		);
		const finalizedFalse = finalizeBranchForSave(
			falseBranch,
			draftVariables,
			draftUpdateTargets,
			declaredSubmits,
		);
		return finalizedTrue !== null && finalizedFalse !== null;
	}, [
		trueBranch,
		falseBranch,
		draftVariables,
		draftUpdateTargets,
		declaredSubmits,
	]);

	const handleSave = useCallback(() => {
		const finalizedTrue = finalizeBranchForSave(
			trueBranch,
			draftVariables,
			draftUpdateTargets,
			declaredSubmits,
		);
		const finalizedFalse = finalizeBranchForSave(
			falseBranch,
			draftVariables,
			draftUpdateTargets,
			declaredSubmits,
		);
		if (finalizedTrue === null || finalizedFalse === null) return;
		onSave({
			condition: serializeCondition(expression),
			true: finalizedTrue,
			false: finalizedFalse,
		});
	}, [
		expression,
		trueBranch,
		falseBranch,
		draftVariables,
		draftUpdateTargets,
		declaredSubmits,
		onSave,
	]);

	return (
		<Modal
			onClose={onCancel}
			panelClassName="evy-modal-panel--action"
			label={`Edit action ${actionIndex + 1}`}
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
		</Modal>
	);
}
