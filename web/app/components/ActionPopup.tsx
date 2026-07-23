import type { UI_RowAction } from "evy-types";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { extractDraftVariables } from "../utils/actionVariables";
import {
	type ConditionExpression,
	parseCondition,
	serializeCondition,
} from "../utils/conditionExpression";
import {
	buildDatumCandidate,
	buildFunctionCandidates,
	buildIdCandidates,
	createGetAttributeCandidatesForQualifier,
} from "../utils/idCandidates";

import { BranchEditor } from "./actionPopup/BranchEditor";
import { ConditionGroupEditor } from "./actionPopup/ConditionGroupEditor";

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

	const draftVariables = useMemo(
		() =>
			extractDraftVariables(flowsById, pagesById, rowsById, activeFlowId),
		[flowsById, pagesById, rowsById, activeFlowId],
	);

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

	const handleSave = useCallback(() => {
		onSave({
			condition: serializeCondition(expression),
			true: trueBranch,
			false: falseBranch,
		});
	}, [expression, trueBranch, falseBranch, onSave]);

	useEscapeKey(onCancel);

	return createPortal(
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
						<span className="evy-popup-section-title">
							Conditions
						</span>
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
							<span className="evy-popup-section-title">
								If true
							</span>
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
					>
						Save
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
