import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	buildTokenHtml,
	getRawCursorIndexFromEditable,
	readRawValueFromNode,
	setEditableCursorAtRawIndex,
} from "../utils/contentEditableTokens";
import {
	filterCandidatesForSuggestionContext,
	getCandidateInsertValue,
	getIdDisplayParts,
	type IdCandidate,
} from "../utils/idCandidates";
import {
	findSuggestionContextAtCursor,
	type IdSearchToken,
	replaceSearchToken,
	type SuggestionContext,
} from "../utils/idTokenSearch";

const css = `
.evy-id-autocomplete-root {
	width: 100%;
}
.evy-id-autocomplete-field {
	position: relative;
	width: 100%;
	min-height: 24px;
	display: flex;
	align-items: center;
	padding: 2px 6px;
	font-size: var(--text-sm);
	color: var(--color-black);
	background-color: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	transition: border-color var(--transition), box-shadow var(--transition);
}
.evy-id-autocomplete-field:hover,
.evy-id-autocomplete-field:focus-within {
	border-color: var(--color-evy-gray);
}
.evy-id-autocomplete-field:focus-within {
	box-shadow: 0 0 0 3px rgba(60, 60, 100, 0.1);
}
/* Reset global input styles — the field div provides all border/focus visuals */
.evy-id-autocomplete-field input[type="text"],
.evy-id-autocomplete-field input[type="text"]:hover,
.evy-id-autocomplete-field input[type="text"]:focus {
	width: 100%;
	padding: 0;
	border: none;
	border-radius: 0;
	box-shadow: none;
	outline: none;
	background: transparent;
	transition: none;
}
.evy-id-autocomplete-plain {
	min-height: 18px;
	cursor: text;
}
.evy-id-autocomplete-token {
	display: inline-flex;
	align-items: center;
	max-width: 100%;
	padding: 1px 5px;
	font-size: var(--text-sm);
	color: var(--color-black);
	background: var(--color-evy-gray-light);
	border: 1px solid var(--color-evy-gray);
	border-radius: 3px;
	cursor: pointer;
}
.evy-id-autocomplete-token:hover {
	background: var(--color-evy-gray-medium);
}
.evy-id-autocomplete-token:focus-visible {
	outline: 2px solid var(--color-evy-blue);
	outline-offset: 1px;
}
.evy-id-autocomplete-token-text {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.evy-id-autocomplete-inline-display {
	display: block;
	width: 100%;
	outline: none;
	cursor: text;
	word-break: break-word;
	white-space: pre-wrap;
}
.evy-id-autocomplete-inline-display--empty::before {
	content: attr(data-placeholder);
	color: var(--color-evy-gray);
	pointer-events: none;
}
.evy-id-autocomplete-inline-token {
	padding: 0 4px;
	border-color: var(--color-gray-border);
	vertical-align: middle;
	margin: 0 1px;
}
.evy-id-autocomplete-inline-attribute {
	cursor: text;
}
.evy-id-autocomplete-dropdown {
	background: var(--color-white);
	border: 1px solid var(--color-gray-border);
	border-radius: var(--radius-sm);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	z-index: 9999;
	max-height: 200px;
	overflow-y: auto;
}
.evy-id-autocomplete-option {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-2);
	width: 100%;
	padding: var(--size-1) var(--size-2);
	font-size: var(--text-sm);
	text-align: left;
	background: none;
	border: none;
	cursor: pointer;
	white-space: nowrap;
}
.evy-id-autocomplete-option-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.evy-id-autocomplete-option-label {
	margin-left: auto;
	font-weight: var(--font-semibold);
	color: var(--color-evy-gray);
}
.evy-id-autocomplete-option:hover,
.evy-id-autocomplete-option[aria-selected="true"] {
	background-color: var(--color-evy-gray-light);
}
.evy-id-autocomplete-option[aria-selected="true"] {
	font-weight: var(--font-medium);
}
`;

let styleInjected = false;
function injectStyle() {
	if (styleInjected) return;
	styleInjected = true;
	const el = document.createElement("style");
	el.textContent = css;
	document.head.appendChild(el);
}

type BuilderAssistProps = {
	id?: string;
	label?: string;
	value: string;
	candidates: IdCandidate[];
	onChange: (next: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	labelClassName?: string;
	getAttributeCandidatesForQualifier?: (qualifier: string) => IdCandidate[];
};

type DropdownPosition = {
	top: number;
	left: number;
	width: number;
};

export function BuilderAssist({
	id,
	label,
	value,
	candidates,
	onChange,
	placeholder,
	ariaLabel,
	labelClassName,
	getAttributeCandidatesForQualifier,
}: BuilderAssistProps) {
	injectStyle();
	const generatedId = useId();
	const inputId = id ?? `builder-assist-${generatedId}`;
	const listboxId = `${inputId}-listbox`;
	const fieldRef = useRef<HTMLDivElement>(null);
	const editableRef = useRef<HTMLDivElement>(null);
	const pendingFocusCursorRef = useRef<number | null>(null);
	const focusedTokenElRef = useRef<HTMLElement | null>(null);
	const [isFieldFocused, setIsFieldFocused] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [activeToken, setActiveToken] = useState<IdSearchToken | null>(null);
	const [activeTokenQuery, setActiveTokenQuery] = useState<string | null>(
		null,
	);
	const [activeSuggestionContext, setActiveSuggestionContext] =
		useState<SuggestionContext | null>(null);
	const [activeIndex, setActiveIndex] = useState(-1);
	const [dropdownPosition, setDropdownPosition] =
		useState<DropdownPosition | null>(null);
	const isSelectingOptionRef = useRef(false);

	const displayParts = useMemo(
		() => getIdDisplayParts(value, candidates),
		[value, candidates],
	);

	const filteredCandidates = useMemo(() => {
		const query = activeTokenQuery ?? activeToken?.text ?? "";
		if (
			!activeSuggestionContext ||
			activeSuggestionContext.type === "none"
		) {
			return [];
		}
		const scopedAttributeCandidates =
			activeSuggestionContext.type === "attribute"
				? (getAttributeCandidatesForQualifier?.(
						activeSuggestionContext.qualifier,
					) ?? [])
				: [];
		return filterCandidatesForSuggestionContext(
			candidates,
			scopedAttributeCandidates,
			{ type: activeSuggestionContext.type, query },
		);
	}, [
		candidates,
		activeSuggestionContext,
		activeToken?.text,
		activeTokenQuery,
		getAttributeCandidatesForQualifier,
	]);

	const highlightedIndex =
		filteredCandidates.length === 0
			? -1
			: Math.min(Math.max(activeIndex, 0), filteredCandidates.length - 1);

	const updateDropdownPosition = useCallback(() => {
		if (!fieldRef.current) return;
		const rect = fieldRef.current.getBoundingClientRect();
		setDropdownPosition({
			top: rect.bottom + 2,
			left: rect.left,
			width: Math.max(rect.width, 160),
		});
	}, []);

	const closeDropdown = useCallback(() => {
		setIsOpen(false);
		setActiveIndex(-1);
		setActiveToken(null);
		setActiveTokenQuery(null);
		setActiveSuggestionContext(null);
	}, []);

	const updateActiveTokenFromValue = useCallback(
		(valueToSearch: string, cursorIndex: number) => {
			const suggestionContext = findSuggestionContextAtCursor(
				valueToSearch,
				cursorIndex,
			);
			setActiveToken(suggestionContext.token);
			setActiveSuggestionContext(suggestionContext);
			setActiveTokenQuery(null);
			setIsOpen(suggestionContext.type !== "none");
			setActiveIndex(0);
			if (suggestionContext.type !== "none") updateDropdownPosition();
		},
		[updateDropdownPosition],
	);

	const commitCandidateInInterpolatedEditable = useCallback(
		(candidate: IdCandidate) => {
			if (!editableRef.current) return;
			const insertValue = getCandidateInsertValue(candidate);

			if (focusedTokenElRef.current) {
				if (candidate.insertMode === "text") {
					focusedTokenElRef.current.replaceWith(
						document.createTextNode(insertValue),
					);
				} else {
					focusedTokenElRef.current.dataset.value = candidate.id;
					focusedTokenElRef.current.textContent = candidate.name;
				}
				focusedTokenElRef.current = null;
				const rawValue = readRawValueFromNode(editableRef.current);
				onChange(rawValue);
				closeDropdown();
				return;
			}

			const rawValue = readRawValueFromNode(editableRef.current);
			const tokenToReplace = activeToken;
			const cursorIndex = getRawCursorIndexFromEditable(
				editableRef.current,
			);
			const nextValue = tokenToReplace
				? replaceSearchToken(rawValue, tokenToReplace, insertValue)
				: `${rawValue.slice(0, cursorIndex)}${insertValue}${rawValue.slice(cursorIndex)}`;
			const nextCursorIndex = tokenToReplace
				? tokenToReplace.start + insertValue.length
				: cursorIndex + insertValue.length;

			pendingFocusCursorRef.current = nextCursorIndex;
			onChange(nextValue);
			setActiveToken(null);
			setActiveTokenQuery(null);
			closeDropdown();
		},
		[activeToken, closeDropdown, onChange],
	);

	const commitCandidate = useCallback(
		(candidate: IdCandidate) => {
			commitCandidateInInterpolatedEditable(candidate);
		},
		[commitCandidateInInterpolatedEditable],
	);

	useEffect(() => {
		if (!isOpen) return;
		updateDropdownPosition();
	}, [isOpen, updateDropdownPosition]);

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (fieldRef.current?.contains(target)) return;
			closeDropdown();
		};
		document.addEventListener("mousedown", handlePointerDown);
		return () =>
			document.removeEventListener("mousedown", handlePointerDown);
	}, [isOpen, closeDropdown]);

	useLayoutEffect(() => {
		const pendingFocus = pendingFocusCursorRef.current;
		const editable = editableRef.current;
		if (!editable) return;

		// While the user is actively typing (focused, no programmatic caret
		// pending), the browser owns the DOM; re-setting innerHTML resets the caret.
		if (pendingFocus === null && document.activeElement === editable)
			return;
		if (readRawValueFromNode(editable) === value && pendingFocus === null) {
			return;
		}
		editable.innerHTML = buildTokenHtml(displayParts);
		if (pendingFocus !== null) {
			pendingFocusCursorRef.current = null;
			editable.focus();
			setEditableCursorAtRawIndex(editable, pendingFocus);
		}
	}, [value, displayParts]);

	const handleListNavigationKey = useCallback(
		(event: React.KeyboardEvent): boolean => {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setIsOpen(true);
				setActiveIndex((c) =>
					Math.min(c + 1, filteredCandidates.length - 1),
				);
				return true;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveIndex((c) => Math.max(c - 1, 0));
				return true;
			}
			return false;
		},
		[filteredCandidates.length],
	);

	const handleAutocompleteKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (handleListNavigationKey(event)) return;

			if (event.key === "Enter") {
				const candidate = filteredCandidates[highlightedIndex];
				if (!candidate) return;
				event.preventDefault();
				commitCandidate(candidate);
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				closeDropdown();
			}
		},
		[
			handleListNavigationKey,
			closeDropdown,
			commitCandidate,
			filteredCandidates,
			highlightedIndex,
		],
	);

	const handleEditableFocus = useCallback(() => {
		setIsFieldFocused(true);
		updateDropdownPosition();
	}, [updateDropdownPosition]);

	const handleEditableBlur = useCallback(() => {
		if (isSelectingOptionRef.current) return;
		setIsFieldFocused(false);
		if (editableRef.current) {
			onChange(readRawValueFromNode(editableRef.current));
		}
		closeDropdown();
	}, [closeDropdown, onChange]);

	const handleEditableInput = useCallback(
		(_event: React.FormEvent<HTMLDivElement>) => {
			if (!editableRef.current) return;
			const nextValue = readRawValueFromNode(editableRef.current);
			const cursorIndex = getRawCursorIndexFromEditable(
				editableRef.current,
			);
			pendingFocusCursorRef.current = cursorIndex;
			onChange(nextValue);
			updateActiveTokenFromValue(nextValue, cursorIndex);
		},
		[onChange, updateActiveTokenFromValue],
	);

	const handleEditableClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			const tokenEl = target.closest<HTMLElement>(
				".evy-id-autocomplete-inline-token",
			);
			// Only real resource chips (with data-value) are clickable for replacement.
			// Attribute spans share the class for styling but have no data-value.
			if (!tokenEl?.dataset.value) {
				focusedTokenElRef.current = null;
				if (!editableRef.current) {
					closeDropdown();
					return;
				}
				updateActiveTokenFromValue(
					readRawValueFromNode(editableRef.current),
					getRawCursorIndexFromEditable(editableRef.current),
				);
				return;
			}
			focusedTokenElRef.current = tokenEl;
			setActiveTokenQuery(tokenEl.textContent ?? "");
			setActiveToken(null);
			setActiveSuggestionContext({
				type: "root",
				trigger: "{",
				token: null,
			});
			setIsOpen(true);
			setActiveIndex(0);
			updateDropdownPosition();
		},
		[closeDropdown, updateActiveTokenFromValue, updateDropdownPosition],
	);

	const handleEditableCursorChange = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			// ArrowDown/ArrowUp control dropdown list navigation (handled in keyDown);
			// skip them here so we don't reset the highlighted candidate index.
			if (event.key === "ArrowDown" || event.key === "ArrowUp") return;
			if (!editableRef.current) return;
			const rawValue = readRawValueFromNode(editableRef.current);
			const cursorIndex = getRawCursorIndexFromEditable(
				editableRef.current,
			);
			updateActiveTokenFromValue(rawValue, cursorIndex);
		},
		[updateActiveTokenFromValue],
	);

	const optionElements = filteredCandidates.map((candidate, index) => {
		const optionId = `${listboxId}-option-${index}`;
		return (
			<button
				key={`${candidate.category}-${candidate.id}`}
				id={optionId}
				type="button"
				role="option"
				aria-label={candidate.name}
				aria-selected={highlightedIndex === index}
				className="evy-id-autocomplete-option"
				onMouseDown={(event) => {
					event.preventDefault();
					isSelectingOptionRef.current = true;
					commitCandidate(candidate);
					queueMicrotask(() => {
						isSelectingOptionRef.current = false;
					});
				}}
			>
				<span className="evy-id-autocomplete-option-name">
					{candidate.name}
				</span>
				<span className="evy-id-autocomplete-option-label">
					{candidate.category.toLowerCase()}
				</span>
			</button>
		);
	});

	const activeDescendant =
		highlightedIndex >= 0
			? `${listboxId}-option-${highlightedIndex}`
			: undefined;
	const hasSuggestionTrigger = Boolean(
		activeSuggestionContext && activeSuggestionContext.type !== "none",
	);
	const shouldRenderDropdown =
		isFieldFocused &&
		isOpen &&
		hasSuggestionTrigger &&
		filteredCandidates.length > 0 &&
		dropdownPosition;

	return (
		<div className="evy-id-autocomplete-root">
			{label && (
				<label htmlFor={inputId} className={labelClassName}>
					{label}
				</label>
			)}
			<div ref={fieldRef} className="evy-id-autocomplete-field">
				<div
					ref={editableRef}
					id={inputId}
					className={`evy-id-autocomplete-inline-display${value.length === 0 ? " evy-id-autocomplete-inline-display--empty" : ""}`}
					data-placeholder={placeholder}
					tabIndex={0}
					contentEditable
					suppressContentEditableWarning
					onFocus={handleEditableFocus}
					onBlur={handleEditableBlur}
					onInput={handleEditableInput}
					onClick={handleEditableClick}
					onKeyDown={handleAutocompleteKeyDown}
					onKeyUp={handleEditableCursorChange}
					aria-label={ariaLabel ?? label}
					aria-autocomplete="list"
					aria-controls={listboxId}
					aria-expanded={isOpen}
					aria-activedescendant={activeDescendant}
					role="combobox"
				/>
			</div>
			{shouldRenderDropdown &&
				createPortal(
					<div
						id={listboxId}
						role="listbox"
						aria-label={ariaLabel ?? label}
						className="evy-id-autocomplete-dropdown"
						style={{
							position: "fixed",
							top: dropdownPosition.top,
							left: dropdownPosition.left,
							width: dropdownPosition.width,
						}}
					>
						{optionElements}
					</div>,
					document.body,
				)}
		</div>
	);
}
