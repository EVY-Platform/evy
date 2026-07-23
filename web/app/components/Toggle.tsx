type ToggleProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	ariaLabel: string;
	label?: string;
	testId?: string;
};

export function Toggle({
	checked,
	onChange,
	ariaLabel,
	label,
	testId,
}: ToggleProps) {
	return (
		<div className="evy-toggle-row">
			{label ? <span className="evy-toggle-label">{label}</span> : null}
			<button
				type="button"
				role="switch"
				className={`evy-toggle${checked ? " evy-toggle--on" : ""}`}
				aria-checked={checked}
				aria-label={ariaLabel}
				data-testid={testId}
				onClick={() => onChange(!checked)}
			>
				<span className="evy-toggle-knob" aria-hidden />
			</button>
		</div>
	);
}
