import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey";
import { createFlowFormCss } from "./createFlowFormCss";
import { modalSharedCss } from "./modalSharedCss";

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
		queueMicrotask(() => inputRef.current?.focus());
	}, [open]);

	useEscapeKey(onClose, open);

	if (!open) return null;

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		const trimmed = flowName.trim();
		if (trimmed === "") return;
		onCreate(trimmed);
		onClose();
	}

	return createPortal(
		<>
			<style>{`${modalSharedCss}\n${createFlowFormCss}`}</style>
			<div className="evy-modal-root">
				<button
					type="button"
					className="evy-modal-backdrop"
					aria-label="Close dialog"
					onClick={onClose}
					data-testid="create-flow-overlay"
				/>
				<div
					className="evy-modal-panel evy-modal-panel--create-flow"
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					data-testid="create-flow-dialog"
				>
					<h2 className="evy-create-flow-title" id={titleId}>
						Create new flow
					</h2>
					<form onSubmit={handleSubmit}>
						<div className="evy-create-flow-field">
							<label className="evy-create-flow-label" htmlFor={inputId}>
								Flow name
							</label>
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
				</div>
			</div>
		</>,
		document.body,
	);
}
