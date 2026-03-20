import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const popoverCss = `
.evy-popover-trigger,
.evy-popover-trigger--breadcrumb {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
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
	padding: 4px 8px;
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
	min-height: var(--size-navbar-control);
	padding: 0 2px 0 var(--spacing-2);
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

export type PopoverOption = {
	value: string;
	label: string;
	separator?: string;
	/** Renders a horizontal rule above this option */
	dividerBefore?: boolean;
	/**
	 * When true, selecting calls `onAction` instead of `onChange` and does not change the value.
	 */
	action?: boolean;
};

type PopoverSelectProps = {
	options: PopoverOption[];
	value: string;
	onChange: (value: string) => void;
	/** Invoked for options with `action: true` */
	onAction?: (value: string) => void;
	ariaLabel: string;
	placeholder?: string;
	/** Navbar-style trigger: blue link + chevron, no box border */
	variant?: "default" | "breadcrumb";
	id?: string;
	/** When true, the menu also opens on pointer hover (e.g. flow selector). */
	openOnHover?: boolean;
};

const HOVER_CLOSE_DELAY_MS = 200;

export function PopoverSelect({
	options,
	value,
	onChange,
	onAction,
	ariaLabel,
	placeholder = "--",
	variant = "default",
	id,
	openOnHover = false,
}: PopoverSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
		minWidth: number;
	} | null>(null);

	const open = useCallback(() => {
		if (!triggerRef.current) return;
		const rect = triggerRef.current.getBoundingClientRect();
		setPosition({
			top: rect.bottom + 2,
			left: rect.left,
			minWidth: Math.max(rect.width, 160),
		});
		setIsOpen(true);
	}, []);

	const clearHoverCloseTimer = useCallback(() => {
		if (hoverCloseTimerRef.current !== null) {
			clearTimeout(hoverCloseTimerRef.current);
			hoverCloseTimerRef.current = null;
		}
	}, []);

	const close = useCallback(() => {
		clearHoverCloseTimer();
		setIsOpen(false);
	}, [clearHoverCloseTimer]);

	const scheduleHoverClose = useCallback(() => {
		clearHoverCloseTimer();
		hoverCloseTimerRef.current = setTimeout(() => {
			hoverCloseTimerRef.current = null;
			close();
		}, HOVER_CLOSE_DELAY_MS);
	}, [clearHoverCloseTimer, close]);

	useEffect(() => {
		return () => clearHoverCloseTimer();
	}, [clearHoverCloseTimer]);

	useEffect(() => {
		if (!isOpen || !menuRef.current || !position) return;
		const menu = menuRef.current;
		const menuRect = menu.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		let adjustedLeft = position.left;
		let adjustedTop = position.top;

		if (menuRect.right > viewportWidth) {
			adjustedLeft = Math.max(0, viewportWidth - menuRect.width - 4);
		}
		if (menuRect.bottom > viewportHeight && triggerRef.current) {
			const triggerRect = triggerRef.current.getBoundingClientRect();
			adjustedTop = triggerRect.top - menuRect.height - 2;
		}

		if (adjustedLeft !== position.left || adjustedTop !== position.top) {
			setPosition((prev) =>
				prev ? { ...prev, left: adjustedLeft, top: adjustedTop } : prev,
			);
		}
	}, [isOpen, position]);

	useEffect(() => {
		if (!isOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				triggerRef.current?.contains(target) ||
				menuRef.current?.contains(target)
			)
				return;
			close();
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [isOpen, close]);

	const handleTriggerPointerEnter = useCallback(() => {
		if (!openOnHover) return;
		clearHoverCloseTimer();
		open();
	}, [openOnHover, clearHoverCloseTimer, open]);

	const handleTriggerPointerLeave = useCallback(() => {
		if (!openOnHover) return;
		scheduleHoverClose();
	}, [openOnHover, scheduleHoverClose]);

	const handleMenuPointerEnter = useCallback(() => {
		if (!openOnHover) return;
		clearHoverCloseTimer();
	}, [openOnHover, clearHoverCloseTimer]);

	const handleMenuPointerLeave = useCallback(() => {
		if (!openOnHover) return;
		scheduleHoverClose();
	}, [openOnHover, scheduleHoverClose]);

	const handleSelect = useCallback(
		(optionValue: string) => {
			const opt = options.find((o) => o.value === optionValue);
			if (opt?.action) {
				onAction?.(optionValue);
				close();
				return;
			}
			onChange(optionValue);
			close();
		},
		[onChange, onAction, close, options],
	);

	const selectedOption = options.find((o) => o.value === value);
	const displayText = selectedOption?.label ?? placeholder;

	const listboxDomId =
		variant === "breadcrumb" && id ? `${id}-listbox` : undefined;

	return (
		<>
			<style>{popoverCss}</style>
			<button
				ref={triggerRef}
				id={id}
				type="button"
				role={variant === "breadcrumb" ? "button" : "combobox"}
				aria-haspopup={variant === "breadcrumb" ? "listbox" : undefined}
				aria-controls={isOpen && listboxDomId ? listboxDomId : undefined}
				aria-label={ariaLabel}
				aria-expanded={isOpen}
				data-value={value}
				onMouseEnter={handleTriggerPointerEnter}
				onMouseLeave={handleTriggerPointerLeave}
				onClick={() => {
					if (isOpen) {
						close();
					} else {
						open();
					}
				}}
				className={
					variant === "breadcrumb"
						? "evy-popover-trigger--breadcrumb"
						: "evy-popover-trigger"
				}
			>
				<span className="evy-popover-text">{displayText}</span>
				<svg
					className="evy-popover-chevron"
					width="10"
					height="10"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<path fill="currentColor" d="M6 9L1 4h10z" />
				</svg>
			</button>
			{isOpen &&
				position &&
				createPortal(
					<div
						ref={menuRef}
						className="evy-popover-menu"
						style={{
							position: "fixed",
							top: position.top,
							left: position.left,
							minWidth: position.minWidth,
						}}
					>
						<div
							className="evy-popover-menu-scroll"
							role="listbox"
							id={listboxDomId}
							aria-label={ariaLabel}
							aria-labelledby={variant === "breadcrumb" && id ? id : undefined}
							onMouseEnter={handleMenuPointerEnter}
							onMouseLeave={handleMenuPointerLeave}
						>
							{options.map((opt) => (
								<span key={opt.value}>
									{opt.separator && (
										<span className="evy-popover-separator">
											{opt.separator}
										</span>
									)}
									{opt.dividerBefore && <hr className="evy-popover-divider" />}
									<button
										type="button"
										role="option"
										aria-selected={opt.action ? false : opt.value === value}
										onClick={() => handleSelect(opt.value)}
										className="evy-popover-option"
									>
										{opt.label}
									</button>
								</span>
							))}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
