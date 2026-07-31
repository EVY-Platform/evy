import { collectSubmitTargetsFromFlatFlow } from "evy-types/flowSubmits";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";

import { useFlowsContext } from "../../state/contexts/FlowsContext";
import { serviceOfSubmitsRef } from "../../utils/flowSubmitOptions";
import { displayLabel } from "../../utils/labelFormatting";
import { Modal } from "../Modal";
import { FlowSubmitsPicker } from "./FlowSubmitsPicker";

type FlowSettingsModalProps = {
	mode: "create" | "edit";
	flowId?: string;
	onClose: () => void;
};

function targetLabel(
	targetRef: string,
	serviceResources: { id: string; name: string }[],
): string {
	const resource = serviceResources.find(
		(serviceResource) => serviceResource.id === targetRef,
	);
	return resource ? displayLabel(resource.name) : targetRef;
}

export function FlowSettingsModal({
	mode,
	flowId,
	onClose,
}: FlowSettingsModalProps) {
	const {
		flowsById,
		pagesById,
		rowsById,
		activeFlowId,
		serviceResources,
		serviceNamesById,
		dispatchRow,
	} = useFlowsContext();

	const targetFlowId = flowId ?? activeFlowId;
	const flow =
		mode === "edit" && targetFlowId ? flowsById[targetFlowId] : undefined;

	const titleId = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const [draftName, setDraftName] = useState(() =>
		mode === "create" ? "" : (flow?.name ?? ""),
	);
	const [draftServiceId, setDraftServiceId] = useState(() =>
		mode === "create"
			? ""
			: serviceOfSubmitsRef(flow?.submits?.resource ?? ""),
	);
	const [draftResourceRef, setDraftResourceRef] = useState(() =>
		mode === "create" ? "" : (flow?.submits?.resource ?? ""),
	);

	const submitTargets = useMemo(() => {
		if (!flow) return new Set<string>();
		return collectSubmitTargetsFromFlatFlow(flow, pagesById, rowsById);
	}, [flow, pagesById, rowsById]);

	const draftSubmitsRef =
		draftServiceId === "" ? "" : draftResourceRef.trim();

	const partialServiceSelection =
		draftServiceId !== "" && draftSubmitsRef === "";

	const conflictNote = useMemo(() => {
		if (submitTargets.size === 0) return null;
		if (submitTargets.size === 1) {
			const [pinnedTarget] = [...submitTargets];
			if (draftSubmitsRef === pinnedTarget) return null;
		}
		const labels = [...submitTargets]
			.sort()
			.map((target) => targetLabel(target, serviceResources))
			.join(", ");
		return `An action in this flow creates ${labels} on submit. Change that action before changing what this flow submits.`;
	}, [submitTargets, draftSubmitsRef, serviceResources]);

	if (mode === "edit" && !flow) return null;

	const saveDisabled =
		draftName.trim() === "" ||
		partialServiceSelection ||
		conflictNote !== null;

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (saveDisabled) return;

		const submits =
			draftSubmitsRef !== "" ? { resource: draftSubmitsRef } : undefined;

		if (mode === "create") {
			dispatchRow({
				type: "CREATE_FLOW",
				name: draftName.trim(),
				submits,
			});
		} else if (targetFlowId) {
			dispatchRow({
				type: "UPDATE_FLOW_SETTINGS",
				flowId: targetFlowId,
				name: draftName.trim(),
				submits,
			});
		}

		onClose();
	}

	const isCreate = mode === "create";

	return (
		<Modal
			onClose={onClose}
			panelClassName="evy-modal-panel--flow-settings"
			labelledBy={titleId}
			panelTestId={
				isCreate ? "create-flow-dialog" : "flow-settings-dialog"
			}
			backdropTestId={
				isCreate ? "create-flow-overlay" : "flow-settings-overlay"
			}
			initialFocusRef={inputRef}
		>
			<h2 className="evy-flow-settings-title" id={titleId}>
				{isCreate ? "Create new flow" : "Flow settings"}
			</h2>
			<form onSubmit={handleSubmit}>
				<div className="evy-flow-settings-field">
					<input
						ref={inputRef}
						className="evy-flow-settings-input"
						type="text"
						value={draftName}
						onChange={(event) => setDraftName(event.target.value)}
						autoComplete="off"
						aria-label="Flow name"
					/>
				</div>
				<div className="evy-flow-settings-field">
					<span className="evy-text-sm evy-font-medium evy-text-black">
						What to submit (optional)
					</span>
					<p className="evy-text-sm evy-text-gray">
						If this flow is to submit or create something, select it
						below.
					</p>
					<FlowSubmitsPicker
						serviceId={draftServiceId}
						resourceRef={draftResourceRef}
						serviceResources={serviceResources}
						serviceNamesById={serviceNamesById}
						onChange={({ serviceId, resourceRef }) => {
							setDraftServiceId(serviceId);
							setDraftResourceRef(resourceRef);
						}}
					/>
				</div>
				{conflictNote && (
					<p className="evy-flow-settings-note evy-flow-settings-note--conflict">
						{conflictNote}
					</p>
				)}
				<div className="evy-modal-footer evy-modal-footer--flow-settings">
					<button
						type="button"
						className="evy-modal-btn evy-modal-btn--sm evy-modal-btn-cancel"
						onClick={onClose}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="evy-modal-btn evy-modal-btn--sm evy-modal-btn-primary"
						disabled={saveDisabled}
					>
						{isCreate ? "Create" : "Save"}
					</button>
				</div>
			</form>
		</Modal>
	);
}
