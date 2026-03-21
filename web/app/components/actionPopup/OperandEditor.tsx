import { useCallback, useMemo } from "react";

import {
	CONDITION_FUNCTIONS,
	parseOperand,
	serializeOperand,
	toVariableOptions,
} from "../../utils/actionHelpers";
import { PopoverSelect, type PopoverOption } from "../PopoverSelect";
import { BOOLEAN_OPTIONS } from "./actionPopupConstants";

export function OperandEditor({
	ariaLabel,
	value,
	draftVariables,
	onChange,
}: {
	ariaLabel: string;
	value: string;
	draftVariables: string[];
	onChange: (value: string) => void;
}) {
	const parsed = useMemo(() => parseOperand(value), [value]);

	const variableOptions: PopoverOption[] = useMemo(
		() => toVariableOptions(draftVariables),
		[draftVariables],
	);

	const primaryOptions: PopoverOption[] = useMemo(() => {
		const values: PopoverOption[] = [
			{ value: "__boolean__", label: "boolean", separator: "Base" },
			{ value: "__number__", label: "number" },
		];
		const variables: PopoverOption[] = variableOptions.map((opt, i) =>
			i === 0 ? { ...opt, separator: "Data" } : opt,
		);
		const functions: PopoverOption[] = CONDITION_FUNCTIONS.map((fn, i) => ({
			value: `__fn__${fn}`,
			label: `${fn}(...)`,
			...(i === 0 ? { separator: "Functions" } : {}),
		}));
		return [...values, ...variables, ...functions];
	}, [variableOptions]);

	const isBooleanValue =
		parsed.type === "value" &&
		(parsed.value === "true" || parsed.value === "false");

	const isNumericValue =
		parsed.type === "value" &&
		parsed.value !== "" &&
		!isBooleanValue &&
		Number.isFinite(Number(parsed.value));

	const primaryValue = useMemo(() => {
		if (parsed.type === "function") return `__fn__${parsed.name}`;
		if (isBooleanValue) return "__boolean__";
		if (isNumericValue) return "__number__";
		return parsed.value;
	}, [parsed, isBooleanValue, isNumericValue]);

	const handlePrimaryChange = useCallback(
		(selected: string) => {
			if (selected.startsWith("__fn__")) {
				const fnName = selected.slice(6);
				onChange(`${fnName}()`);
			} else if (selected === "__boolean__") {
				onChange("true");
			} else if (selected === "__number__") {
				onChange("0");
			} else {
				onChange(selected);
			}
		},
		[onChange],
	);

	const handleArgChange = useCallback(
		(arg: string) => {
			if (parsed.type !== "function") return;
			onChange(serializeOperand({ ...parsed, arg }));
		},
		[parsed, onChange],
	);

	return (
		<div className="evy-flex evy-flex-col evy-gap-1 evy-flex-1">
			<PopoverSelect
				ariaLabel={ariaLabel}
				options={primaryOptions}
				value={primaryValue}
				onChange={handlePrimaryChange}
			/>
			{isBooleanValue && (
				<PopoverSelect
					ariaLabel={`${ariaLabel}-boolean`}
					options={BOOLEAN_OPTIONS}
					value={parsed.value}
					onChange={onChange}
				/>
			)}
			{isNumericValue && (
				<input
					type="number"
					step="any"
					aria-label={`${ariaLabel}-number`}
					value={parsed.value}
					onChange={(e) => onChange(e.target.value)}
					className="evy-action-popup-number-input evy-w-full evy-box-sizing-border evy-rounded-sm evy-border evy-border-gray-light evy-focus-visible:outline-none"
				/>
			)}
			{parsed.type === "function" && (
				<PopoverSelect
					ariaLabel={`${ariaLabel}-arg`}
					options={variableOptions}
					value={parsed.arg}
					onChange={handleArgChange}
					placeholder="argument..."
				/>
			)}
		</div>
	);
}
