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
import { useAnchoredDropdownPosition } from "../hooks/useAnchoredDropdownPosition";
import { useOutsideClick } from "../hooks/useOutsideClick";
import {
	filterCandidatesForSuggestionContext,
	getCandidateInsertValue,
	type IdCandidate,
} from "../utils/idCandidates";
import {
	findSuggestionContextAtCursor,
	type IdSearchToken,
	replaceSearchToken,
	type SuggestionContext,
} from "../utils/idTokenSearch";

type AutocompleteSearchProps = {
	id?: string;
	label?: string;
	value: string;
	candidates: IdCandidate[];
	onChange: (next: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	labelClassName?: string;
	multiline?: boolean;
	getAttributeCandidatesForQualifier?: (qualifier: string) => IdCandidate[];
};

export function AutocompleteSearch({
	id,
	label,
	value,
	candidates,
	onChange,
	placeholder,
	ariaLabel,
	labelClassName,
	multiline,
	getAttributeCandidatesForQualifier,
}: AutocompleteSearchProps) {
	const generatedId = useId();
	const inputId = id ?? `autocomplete-search-${generatedId}`;
	const listboxId = `${inputId}-listbox`;
	const fieldRef = useRef<HTMLDivElement>(null);
	const fieldElementRef = useRef<
		HTMLInputElement | HTMLTextAreaElement | null
	>(null);
	const pendingFocusCursorRef = useRef<number | null>(null);
	const [isFieldFocused, setIsFieldFocused] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [activeToken, setActiveToken] = useState<IdSearchToken | null>(null);
	const [activeTokenQuery, setActiveTokenQuery] = useState<string | null>(
		null,
	);
	const [activeSuggestionContext, setActiveSuggestionContext] =
		useState<SuggestionContext | null>(null);
	const [activeIndex, setActiveIndex] = useState(-1);
	const {
		position: dropdownPosition,
		updatePosition: updateDropdownPosition,
	} = useAnchoredDropdownPosition(fieldRef);
	const isSelectingOptionRef = useRef(false);

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

	const commitCandidate = useCallback(
		(candidate: IdCandidate) => {
			const element = fieldElementRef.current;
			if (!element) return;
			const insertValue = getCandidateInsertValue(candidate);
			const tokenToReplace = activeToken;
			const cursorIndex = element.selectionStart ?? value.length;
			const nextValue = tokenToReplace
				? replaceSearchToken(value, tokenToReplace, insertValue)
				: `${value.slice(0, cursorIndex)}${insertValue}${value.slice(cursorIndex)}`;
			const nextCursorIndex = tokenToReplace
				? tokenToReplace.start + insertValue.length
				: cursorIndex + insertValue.length;

			pendingFocusCursorRef.current = nextCursorIndex;
			onChange(nextValue);
			setActiveToken(null);
			setActiveTokenQuery(null);
			closeDropdown();
		},
		[activeToken, closeDropdown, onChange, value],
	);

	useEffect(() => {
		if (!isOpen) return;
		updateDropdownPosition();
	}, [isOpen, updateDropdownPosition]);

	const isInsideField = useCallback(
		(target: Node) => Boolean(fieldRef.current?.contains(target)),
		[],
	);
	useOutsideClick(isOpen, isInsideField, closeDropdown);

	// biome-ignore lint/correctness/useExhaustiveDependencies: caret placement runs after programmatic value updates
	useLayoutEffect(() => {
		const pendingFocus = pendingFocusCursorRef.current;
		const element = fieldElementRef.current;
		if (!element || pendingFocus === null) return;

		pendingFocusCursorRef.current = null;
		element.focus();
		element.setSelectionRange(pendingFocus, pendingFocus);
	}, [value]);

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

	const handleInputFocus = useCallback(() => {
		setIsFieldFocused(true);
		updateDropdownPosition();
	}, [updateDropdownPosition]);

	const handleInputBlur = useCallback(() => {
		if (isSelectingOptionRef.current) return;
		setIsFieldFocused(false);
		closeDropdown();
	}, [closeDropdown]);

	const handleInputChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const nextValue = event.target.value;
			const cursorIndex = event.target.selectionStart ?? nextValue.length;
			pendingFocusCursorRef.current = cursorIndex;
			onChange(nextValue);
			updateActiveTokenFromValue(nextValue, cursorIndex);
		},
		[onChange, updateActiveTokenFromValue],
	);

	const handleInputClick = useCallback(
		(event: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			const cursorIndex =
				event.currentTarget.selectionStart ?? value.length;
			updateActiveTokenFromValue(value, cursorIndex);
		},
		[updateActiveTokenFromValue, value],
	);

	const handleInputCursorChange = useCallback(
		(
			event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
		) => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") return;
			const cursorIndex =
				event.currentTarget.selectionStart ?? value.length;
			updateActiveTokenFromValue(value, cursorIndex);
		},
		[updateActiveTokenFromValue, value],
	);

	const optionElements = filteredCandidates.map((candidate, index) => {
		const optionId = `${listboxId}-option-${index}`;
		const insertValue = getCandidateInsertValue(candidate);
		return (
			<button
				key={`${candidate.category}-${candidate.id}`}
				id={optionId}
				type="button"
				role="option"
				aria-label={insertValue}
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
					{insertValue}
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

	const inputProps = {
		id: inputId,
		className: "evy-id-autocomplete-input",
		value,
		placeholder,
		onFocus: handleInputFocus,
		onBlur: handleInputBlur,
		onChange: handleInputChange,
		onClick: handleInputClick,
		onKeyDown: handleAutocompleteKeyDown,
		onKeyUp: handleInputCursorChange,
		"aria-label": ariaLabel ?? label,
		"aria-autocomplete": "list" as const,
		"aria-controls": listboxId,
		"aria-expanded": isOpen,
		"aria-activedescendant": activeDescendant,
		role: "combobox" as const,
		ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
			fieldElementRef.current = element;
		},
	};

	return (
		<div className="evy-id-autocomplete-root">
			{label && (
				<label htmlFor={inputId} className={labelClassName}>
					{label}
				</label>
			)}
			<div ref={fieldRef} className="evy-id-autocomplete-field">
				{multiline ? (
					<textarea {...inputProps} />
				) : (
					<input type="text" {...inputProps} />
				)}
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
