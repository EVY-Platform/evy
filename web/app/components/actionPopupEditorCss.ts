/**
 * Action editor–specific layout (conditions, branches, grid rows).
 * Modal shell lives in {@link modalSharedCss}.
 */
export const actionPopupEditorCss = `
.evy-popup-header {
	padding: var(--size-4);
	border-bottom: 1px solid var(--color-gray-border);
}
.evy-popup-body {
	padding: var(--size-8);
	overflow-y: auto;
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: var(--size-3);
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
	margin-top: var(--size-2);
}
.evy-condition-row {
	display: grid;
	grid-template-columns: 1fr auto 1fr auto auto;
	gap: 6px;
	align-items: start;
}
.evy-condition-row--placeholder {
	grid-template-columns: 1fr auto 1fr;
}
.evy-condition-logic-row {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--size-2) 0;
}
.evy-segment-control {
	display: inline-flex;
	border-radius: var(--radius-sm);
}
.evy-segment-control button {
	flex: 1 1 0%;
	padding: 2px 14px;
	font-size: var(--text-xs);
	font-family: inherit;
	border: 1px solid var(--color-gray-border);
	cursor: pointer;
	transition: background var(--transition);
}
.evy-segment-control button:first-child {
	border-top-left-radius: var(--radius-sm);
	border-bottom-left-radius: var(--radius-sm);
	border-right-width: 0;
}
.evy-segment-control button:last-child {
	border-top-right-radius: var(--radius-sm);
	border-bottom-right-radius: var(--radius-sm);
	border-left-width: 0;
}
.evy-segment-btn--active {
	background-color: var(--color-evy-gray-light);
}
.evy-segment-btn--inactive {
	background-color: var(--color-white);
}
.evy-segment-btn--inactive:hover {
	background-color: var(--color-evy-gray-light);
}
.evy-condition-remove,
.evy-condition-nest-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	border-radius: var(--radius-sm);
	margin-top: 2px;
}
.evy-condition-nest-btn:hover {
	color: var(--color-blue);
}
.evy-condition-nested-group {
	margin-left: var(--size-4);
	padding-left: var(--size-3);
	border-left: 2px solid var(--color-gray-border);
}
`;
