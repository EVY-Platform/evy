/** Page-in-use warning dialog body + header; panel shell + footer use {@link modalSharedCss}. */
export const pageInUseDialogCss = `
.evy-modal-panel--page-in-use {
	width: min(480px, calc(100vw - var(--size-8)));
	max-height: 80vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}
.evy-page-in-use-header {
	padding: var(--size-4);
	border-bottom: 1px solid var(--color-gray-border);
}
.evy-page-in-use-body {
	padding: var(--size-4) var(--size-8);
	overflow: auto;
	flex: 1;
	min-height: 0;
}
.evy-page-in-use-description {
	font-size: var(--text-sm);
	margin: 0 0 var(--size-3) 0;
}
.evy-page-in-use-list {
	margin: 0;
	padding-left: var(--size-4);
	list-style: disc;
}
.evy-page-in-use-list li {
	font-size: var(--text-sm);
	line-height: 1.6;
}
`;
