import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "../hooks/useEscapeKey";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[contenteditable="true"]',
	'[tabindex]:not([tabindex="-1"])',
].join(",");

type ModalProps = {
	onClose: () => void;
	children: ReactNode;
	/** Modifier appended to `evy-modal-panel`, e.g. `evy-modal-panel--action`. */
	panelClassName?: string;
	/** Id of the element naming the dialog. Prefer this over `label`. */
	labelledBy?: string;
	/** Fallback accessible name when no visible title element exists. */
	label?: string;
	panelTestId?: string;
	backdropTestId?: string;
	/** Focused when the dialog opens; defaults to the first focusable element. */
	initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * The single dialog primitive: portal, backdrop, escape handling, focus trap and
 * focus restoration. Panels keep their own layout via `panelClassName`.
 */
export function Modal({
	onClose,
	children,
	panelClassName,
	labelledBy,
	label,
	panelTestId,
	backdropTestId,
	initialFocusRef,
}: ModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	useEscapeKey(onClose);

	// Restore focus to whatever opened the dialog once it closes.
	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		return () => previouslyFocused?.focus?.();
	}, []);

	useEffect(() => {
		if (initialFocusRef?.current) {
			queueMicrotask(() => initialFocusRef.current?.focus());
			return;
		}
		const first =
			panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		queueMicrotask(() => first?.focus());
	}, [initialFocusRef]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
		if (event.key !== "Tab") return;
		const panel = panelRef.current;
		if (!panel) return;

		// Anchored menus (PopoverSelect, AutocompleteSearch) render into their own
		// portals outside the panel. While one holds focus it owns keyboard
		// navigation, so the trap stays out of the way.
		if (!panel.contains(document.activeElement)) return;

		const focusable = Array.from(
			panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
		).filter((element) => element.offsetParent !== null);
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}, []);

	return createPortal(
		<div className="evy-modal-root">
			<button
				type="button"
				className="evy-modal-backdrop"
				aria-label="Close dialog"
				onClick={onClose}
				data-testid={backdropTestId}
			/>
			<div
				ref={panelRef}
				className={
					panelClassName
						? `evy-modal-panel ${panelClassName}`
						: "evy-modal-panel"
				}
				role="dialog"
				aria-modal="true"
				aria-labelledby={labelledBy}
				aria-label={labelledBy ? undefined : label}
				data-testid={panelTestId}
				onKeyDown={handleKeyDown}
			>
				{children}
			</div>
		</div>,
		document.body,
	);
}
