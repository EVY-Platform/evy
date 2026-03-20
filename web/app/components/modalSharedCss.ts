/**
 * Shared modal styles for overlay + backdrop + panel shell + footer buttons.
 * Used by {@link ActionPopup} and {@link CreateFlowDialog}.
 */
export const modalSharedCss = `
.evy-modal-root {
	position: fixed;
	inset: 0;
	/* Below PopoverSelect menus (z-index 9999) so dropdowns inside modals receive clicks */
	z-index: 9000;
	display: flex;
	align-items: center;
	justify-content: center;
}
.evy-modal-backdrop {
	position: absolute;
	inset: 0;
	border: none;
	padding: 0;
	margin: 0;
	background: rgba(0, 0, 0, 0.3);
	cursor: default;
}
.evy-modal-panel {
	position: relative;
	z-index: 1;
	background: var(--color-white);
	border-radius: var(--radius-md);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.evy-modal-panel--action {
	width: 680px;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.evy-modal-panel--create-flow {
	width: min(400px, calc(100vw - var(--size-8)));
	padding: var(--size-4);
	display: flex;
	flex-direction: column;
	gap: var(--size-3);
}
.evy-modal-footer {
	padding: var(--size-3) var(--size-4);
	border-top: 1px solid var(--color-gray-border);
	display: flex;
	justify-content: flex-end;
	gap: var(--size-2);
}
.evy-modal-btn {
	font-family: inherit;
	border-radius: var(--radius-sm);
	border: 1px solid var(--color-gray-border);
	cursor: pointer;
	transition: all var(--transition);
}
.evy-modal-btn--md {
	font-size: var(--text-md);
	padding: var(--size-2) 20px;
}
.evy-modal-btn--sm {
	font-size: var(--text-sm);
	padding: var(--size-2) var(--size-4);
}
.evy-modal-btn-cancel {
	background: var(--color-white);
	color: var(--color-black);
}
.evy-modal-btn-cancel:hover {
	background: var(--color-evy-gray-light);
}
.evy-modal-btn-primary {
	background: var(--color-black);
	color: var(--color-white);
	border-color: var(--color-black);
}
.evy-modal-btn-primary:hover:not(:disabled) {
	opacity: 0.85;
}
.evy-modal-btn-primary:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}
`;
