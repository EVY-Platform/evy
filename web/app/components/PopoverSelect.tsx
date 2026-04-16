import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";
import { popoverSelectCss } from "./popoverSelectCss";

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
			<style>{popoverSelectCss}</style>
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
					// With hover-open, pointer hover may open the menu before click; toggling
					// closed here races with Playwright (hover → click) and flakes tests.
					if (openOnHover) {
						if (!isOpen) open();
					} else if (isOpen) close();
					else open();
				}}
				className={
					variant === "breadcrumb"
						? "evy-popover-trigger--breadcrumb"
						: "evy-popover-trigger"
				}
			>
				<span className="evy-popover-text">{displayText}</span>
				<ChevronDown
					className="evy-popover-chevron"
					width={10}
					height={10}
					strokeWidth={LUCIDE_STROKE_WIDTH}
					aria-hidden
				/>
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
