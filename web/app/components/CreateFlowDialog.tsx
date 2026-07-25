import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { Modal } from "./Modal";

type CreateFlowDialogProps = {
	open: boolean;
	onClose: () => void;
	onCreate: (name: string) => void;
};

export function CreateFlowDialog({
	open,
	onClose,
	onCreate,
}: CreateFlowDialogProps) {
	const titleId = useId();
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [flowName, setFlowName] = useState("");

	useEffect(() => {
		if (!open) return;
		setFlowName("");
	}, [open]);

	if (!open) return null;

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const trimmed = flowName.trim();
		if (trimmed === "") return;
		onCreate(trimmed);
		onClose();
	}

	return (
		<Modal
			onClose={onClose}
			panelClassName="evy-modal-panel--create-flow"
			labelledBy={titleId}
			panelTestId="create-flow-dialog"
			backdropTestId="create-flow-overlay"
			initialFocusRef={inputRef}
		>
			<h2 className="evy-create-flow-title" id={titleId}>
				Create new flow
			</h2>
			<form onSubmit={handleSubmit}>
				<div className="evy-create-flow-field">
					<label htmlFor={inputId}>Flow name</label>
					<input
						ref={inputRef}
						id={inputId}
						className="evy-create-flow-input"
						type="text"
						value={flowName}
						onChange={(e) => setFlowName(e.target.value)}
						autoComplete="off"
					/>
				</div>
				<div className="evy-modal-footer">
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
						disabled={flowName.trim() === ""}
					>
						Create
					</button>
				</div>
			</form>
		</Modal>
	);
}
