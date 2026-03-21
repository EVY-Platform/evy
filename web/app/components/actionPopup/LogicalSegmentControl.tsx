import type { LogicalOperator } from "../../utils/actionHelpers";

export function LogicalSegmentControl({
	value,
	onChange,
	testId,
}: {
	value: LogicalOperator;
	onChange: () => void;
	testId: string;
}) {
	return (
		<div className="evy-condition-logic-row">
			<div className="evy-segment-control" data-testid={testId}>
				<button
					type="button"
					className={
						value === "and"
							? "evy-segment-btn--active"
							: "evy-segment-btn--inactive"
					}
					onClick={value === "and" ? undefined : onChange}
				>
					AND
				</button>
				<button
					type="button"
					className={
						value === "or"
							? "evy-segment-btn--active"
							: "evy-segment-btn--inactive"
					}
					onClick={value === "or" ? undefined : onChange}
				>
					OR
				</button>
			</div>
		</div>
	);
}
