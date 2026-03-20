/**
 * Action editor–specific layout (conditions, branches, grid rows).
 * Modal shell lives in {@link modalSharedCss}.
 */
export const actionPopupEditorCss = `
.evy-popup-header {
	padding: var(--size-4) var(--size-4);
	border-bottom: 1px solid var(--color-gray-border);
}
.evy-popup-body {
	padding: var(--size-4);
	overflow-y: auto;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: var(--size-3);
}
.evy-popup-section {
	background: var(--color-evy-gray-light);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-md);
	padding: var(--size-3);
}
.evy-popup-section-title {
	font-size: var(--text-sm);
	font-weight: var(--font-semibold);
	color: var(--color-black);
	margin-bottom: var(--size-2);
	display: block;
}
.evy-popup-branches {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--size-3);
}
.evy-condition-row {
	display: grid;
	grid-template-columns: 1fr auto 1fr auto;
	gap: 6px;
	align-items: start;
}
.evy-condition-or {
	display: block;
	text-align: center;
	font-size: 0.625rem;
	font-weight: var(--font-semibold);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--color-evy-gray);
	padding: 2px 0;
}
.evy-condition-remove {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: var(--radius-sm);
	margin-top: 2px;
}
`;
