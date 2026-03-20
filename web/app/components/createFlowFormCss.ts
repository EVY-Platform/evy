/** Create-flow form fields only; shell uses {@link modalSharedCss}. */
export const createFlowFormCss = `
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
`;
