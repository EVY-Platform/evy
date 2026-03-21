export const popoverSelectCss = `
.evy-popover-trigger,
.evy-popover-trigger--breadcrumb {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-1);
	font-size: var(--text-sm);
	font-family: inherit;
	text-align: left;
	cursor: pointer;
	min-width: 0;
}
.evy-popover-trigger {
	padding: 2px 6px;
	color: var(--color-black);
	background-color: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	width: 100%;
	transition:
		border-color var(--transition),
		box-shadow var(--transition);
}
.evy-popover-trigger:hover {
	border-color: var(--color-evy-gray);
}
.evy-popover-trigger:focus {
	outline: none;
	border-color: var(--color-evy-gray);
	box-shadow: 0 0 0 3px rgba(60, 60, 100, 0.1);
}
.evy-popover-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	flex: 1;
	min-width: 0;
}
.evy-popover-chevron {
	flex-shrink: 0;
	opacity: var(--opacity-60);
}
.evy-popover-menu {
	background: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	z-index: 9999;
	max-height: 200px;
	overflow: hidden;
}
.evy-popover-menu-scroll {
	max-height: 200px;
	overflow-y: auto;
	overscroll-behavior: contain;
	padding: 2px 0;
}
.evy-popover-option {
	display: block;
	width: 100%;
	padding: var(--size-1) var(--size-2);
	font-size: var(--text-sm);
	font-family: inherit;
	text-align: left;
	background: none;
	border: none;
	cursor: pointer;
	white-space: nowrap;
}
.evy-popover-option:hover {
	background-color: var(--color-evy-gray-light);
}
.evy-popover-option[aria-selected="true"] {
	font-weight: var(--font-medium);
	background-color: var(--color-evy-gray-light);
}
.evy-popover-separator {
	padding: 4px 8px 2px;
	font-size: 0.625rem;
	font-weight: var(--font-semibold);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--color-evy-gray);
	border-top: 1px solid var(--color-gray-border);
	margin-top: 2px;
}
.evy-popover-divider {
	border: none;
	border-top: 1px solid var(--color-gray-border);
	margin: 6px 0 0;
	height: 0;
}
.evy-popover-trigger--breadcrumb {
	width: auto;
	max-width: 14rem;
	min-height: var(--size-nav-control);
	padding: 0 2px 0 var(--size-2);
	font-weight: var(--font-semibold);
	line-height: 1.5;
	color: var(--color-evy-blue);
	background: transparent;
	border: none;
	border-radius: 0;
	outline: none;
	box-shadow: none;
	appearance: none;
}
.evy-popover-trigger--breadcrumb:hover {
	text-decoration: underline;
}
.evy-popover-trigger--breadcrumb:focus {
	outline: none;
	box-shadow: none;
	border: none;
}
.evy-popover-trigger--breadcrumb:focus-visible {
	outline: 2px solid var(--color-evy-blue);
	outline-offset: 2px;
}
.evy-popover-trigger--breadcrumb .evy-popover-chevron {
	opacity: 1;
	color: var(--color-evy-blue);
}
`;
