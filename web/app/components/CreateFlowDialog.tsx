import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const createFlowDialogCss = `
.evy-create-flow-overlay {
	position: fixed;
	inset: 0;
	z-index: 10000;
	display: flex;
	align-items: center;
	justify-content: center;
}
.evy-create-flow-backdrop {
	position: absolute;
	inset: 0;
	border: none;
	padding: 0;
	margin: 0;
	background: rgba(0, 0, 0, 0.3);
	cursor: default;
}
.evy-create-flow-panel {
	position: relative;
	z-index: 1;
	background: var(--color-white);
	border-radius: var(--radius-md);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	width: min(400px, calc(100vw - var(--size-8)));
	padding: var(--size-4);
	display: flex;
	flex-direction: column;
	gap: var(--size-3);
}
.evy-create-flow-title {
	font-size: var(--text-md);
	font-weight: var(--font-semibold);
	margin: 0;
}
.evy-create-flow-field {
	display: flex;
	flex-direction: column;
	gap: var(--size-1);
}
.evy-create-flow-label {
	font-size: var(--text-sm);
	color: var(--color-black);
}
.evy-create-flow-input {
	font-size: var(--text-sm);
	font-family: inherit;
	padding: 8px 10px;
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
}
.evy-create-flow-input:focus {
	outline: 2px solid var(--color-evy-blue);
	outline-offset: 1px;
}
.evy-create-flow-footer {
	display: flex;
	justify-content: flex-end;
	gap: var(--size-2);
}
.evy-create-flow-btn {
	font-size: var(--text-sm);
	font-family: inherit;
	padding: var(--size-2) var(--size-4);
	border-radius: var(--radius-sm);
	border: 1px solid var(--color-gray-border);
	cursor: pointer;
}
.evy-create-flow-btn-cancel {
	background: var(--color-white);
	color: var(--color-black);
}
.evy-create-flow-btn-cancel:hover {
	background: var(--color-evy-gray-light);
}
.evy-create-flow-btn-primary {
	background: var(--color-black);
	color: var(--color-white);
	border-color: var(--color-black);
}
.evy-create-flow-btn-primary:hover:not(:disabled) {
	opacity: 0.85;
}
.evy-create-flow-btn-primary:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}
`;

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

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

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
			<style>{createFlowDialogCss}</style>
			<div className="evy-create-flow-overlay">
				<button
					type="button"
					className="evy-create-flow-backdrop"
					aria-label="Close dialog"
					onClick={onClose}
					data-testid="create-flow-overlay"
				/>
				<div
					className="evy-create-flow-panel"
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
						<div className="evy-create-flow-footer">
							<button
								type="button"
								className="evy-create-flow-btn evy-create-flow-btn-cancel"
								onClick={onClose}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="evy-create-flow-btn evy-create-flow-btn-primary"
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
