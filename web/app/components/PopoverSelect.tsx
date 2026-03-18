import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const popoverCss = `
.evy-popover-trigger {
	display: inline-flex;
	align-items: center;
	justify-content: space-between;
	gap: 4px;
	padding: 2px 6px;
	font-size: var(--text-sm);
	font-family: inherit;
	color: var(--color-black);
	background-color: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	cursor: pointer;
	min-width: 0;
	width: 100%;
	text-align: left;
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
`;

export type PopoverOption = {
	value: string;
	label: string;
};

type PopoverSelectProps = {
	options: PopoverOption[];
	value: string;
	onChange: (value: string) => void;
	ariaLabel: string;
	placeholder?: string;
};

export function PopoverSelect({
	options,
	value,
	onChange,
	ariaLabel,
	placeholder = "--",
}: PopoverSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
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

	const close = useCallback(() => {
		setIsOpen(false);
	}, []);

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

	const handleSelect = useCallback(
		(optionValue: string) => {
			onChange(optionValue);
			close();
		},
		[onChange, close],
	);

	const selectedOption = options.find((o) => o.value === value);
	const displayText = selectedOption?.label ?? placeholder;

	return (
		<>
			<style>{popoverCss}</style>
			<button
				ref={triggerRef}
				type="button"
				role="combobox"
				aria-label={ariaLabel}
				aria-expanded={isOpen}
				data-value={value}
				onClick={() => (isOpen ? close() : open())}
				className="evy-popover-trigger"
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
							aria-label={ariaLabel}
						>
							{options.map((opt) => (
								<button
									key={opt.value}
									type="button"
									role="option"
									aria-selected={opt.value === value}
									onClick={() => handleSelect(opt.value)}
									className="evy-popover-option"
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
