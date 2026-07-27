import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAnchoredDropdownPosition } from "../hooks/useAnchoredDropdownPosition";
import { useOutsideClick } from "../hooks/useOutsideClick";
import { LUCIDE_STROKE_WIDTH } from "../icons/iconSyntax";

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
	const [activeIndex, setActiveIndex] = useState(-1);
	const [searchQuery, setSearchQuery] = useState("");
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const { position, setPosition, updatePosition } =
		useAnchoredDropdownPosition(triggerRef);

	const filteredOptions = useMemo(
		() =>
			searchQuery.trim()
				? options.filter((option) =>
						option.label
							.toLowerCase()
							.includes(searchQuery.toLowerCase()),
					)
				: options,
		[options, searchQuery],
	);

	const open = useCallback(() => {
		if (!triggerRef.current) return;
		updatePosition();
		setSearchQuery("");
		setActiveIndex(options.findIndex((option) => option.value === value));
		setIsOpen(true);
	}, [options, value, updatePosition]);

	const clearHoverCloseTimer = useCallback(() => {
		if (hoverCloseTimerRef.current !== null) {
			clearTimeout(hoverCloseTimerRef.current);
			hoverCloseTimerRef.current = null;
		}
	}, []);

	const close = useCallback(
		(restoreFocus = true) => {
			clearHoverCloseTimer();
			setActiveIndex(-1);
			setSearchQuery("");
			setIsOpen(false);
			if (restoreFocus) {
				triggerRef.current?.focus();
			}
		},
		[clearHoverCloseTimer],
	);

	const focusSearch = useCallback(() => {
		requestAnimationFrame(() => searchRef.current?.focus());
	}, []);

	const scheduleHoverClose = useCallback(() => {
		clearHoverCloseTimer();
		hoverCloseTimerRef.current = setTimeout(() => {
			hoverCloseTimerRef.current = null;
			// Hover dismiss should not move focus onto the trigger label.
			close(false);
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
	}, [isOpen, position, setPosition]);

	const isInsidePopover = useCallback(
		(target: Node) =>
			Boolean(
				triggerRef.current?.contains(target) ||
					menuRef.current?.contains(target),
			),
		[],
	);
	useOutsideClick(isOpen, isInsidePopover, close);

	useEffect(() => {
		if (isOpen && position) {
			focusSearch();
		}
	}, [isOpen, position, focusSearch]);

	useEffect(() => {
		if (activeIndex < 0 || !menuRef.current) return;
		const activeEl = menuRef.current.querySelector(
			`[data-option-index="${activeIndex}"]`,
		) as HTMLElement | null;
		activeEl?.scrollIntoView({ block: "nearest" });
	}, [activeIndex]);

	const handleTriggerPointerEnter = useCallback(() => {
		if (!openOnHover) return;
		clearHoverCloseTimer();
		if (!isOpen) open();
	}, [openOnHover, clearHoverCloseTimer, isOpen, open]);

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

	const handleSearchKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setActiveIndex((currentIndex) =>
					Math.min(currentIndex + 1, filteredOptions.length - 1),
				);
			} else if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0));
			} else if (event.key === "Enter") {
				event.preventDefault();
				const candidate =
					filteredOptions[activeIndex] ?? filteredOptions[0];
				if (candidate) handleSelect(candidate.value);
			} else if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				close();
			}
		},
		[activeIndex, filteredOptions, handleSelect, close],
	);

	const handleTriggerKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>) => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				if (!isOpen) open();
				else focusSearch();
			} else if (event.key === "Escape" && isOpen) {
				event.preventDefault();
				event.stopPropagation();
				close();
			} else if (
				isOpen &&
				event.key.length === 1 &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey
			) {
				// Typeahead while focus is still on the trigger (e.g. after click).
				event.preventDefault();
				setSearchQuery((currentQuery) => currentQuery + event.key);
				setActiveIndex(-1);
				focusSearch();
			}
		},
		[isOpen, open, close, focusSearch],
	);

	const selectedOption = options.find((o) => o.value === value);
	const displayText = selectedOption?.label ?? placeholder;

	const listboxDomId =
		variant === "breadcrumb" && id ? `${id}-listbox` : undefined;

	return (
		<>
			<button
				ref={triggerRef}
				id={id}
				type="button"
				role={variant === "breadcrumb" ? "button" : "combobox"}
				aria-haspopup={variant === "breadcrumb" ? "listbox" : undefined}
				aria-controls={
					isOpen && listboxDomId ? listboxDomId : undefined
				}
				aria-label={ariaLabel}
				aria-expanded={isOpen}
				data-value={value}
				onMouseEnter={handleTriggerPointerEnter}
				onMouseLeave={handleTriggerPointerLeave}
				onKeyDown={handleTriggerKeyDown}
				onMouseDown={(event) => {
					// Keep focus in the search field when the menu is already open on hover.
					if (openOnHover && isOpen) {
						event.preventDefault();
					}
				}}
				onClick={() => {
					// With hover-open, pointer hover may open the menu before click; toggling
					// closed here races with Playwright (hover → click) and flakes tests.
					if (openOnHover) {
						if (!isOpen) open();
						else focusSearch();
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
							minWidth: position.width,
						}}
					>
						<input
							ref={searchRef}
							type="text"
							className="evy-popover-search"
							value={searchQuery}
							placeholder="Search…"
							onChange={(event) => {
								setSearchQuery(event.target.value);
								setActiveIndex(-1);
							}}
							onKeyDown={handleSearchKeyDown}
							onMouseEnter={handleMenuPointerEnter}
							onMouseLeave={handleMenuPointerLeave}
						/>
						<div
							className="evy-popover-menu-scroll"
							role="listbox"
							id={listboxDomId}
							aria-label={ariaLabel}
							aria-activedescendant={
								activeIndex >= 0 && listboxDomId
									? `${listboxDomId}-opt-${activeIndex}`
									: undefined
							}
							aria-labelledby={
								variant === "breadcrumb" && id ? id : undefined
							}
							onMouseEnter={handleMenuPointerEnter}
							onMouseLeave={handleMenuPointerLeave}
							tabIndex={-1}
						>
							{filteredOptions.map((opt, index) => (
								<span key={opt.value}>
									{opt.separator && (
										<span className="evy-popover-separator">
											{opt.separator}
										</span>
									)}
									{opt.dividerBefore && (
										<hr className="evy-popover-divider" />
									)}
									<button
										type="button"
										role="option"
										id={
											listboxDomId
												? `${listboxDomId}-opt-${index}`
												: undefined
										}
										data-option-index={index}
										aria-selected={
											opt.action
												? false
												: opt.value === value
										}
										onClick={() => handleSelect(opt.value)}
										className={`evy-popover-option${index === activeIndex ? " evy-popover-option--active" : ""}`}
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
