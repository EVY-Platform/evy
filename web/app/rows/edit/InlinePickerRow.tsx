import { EVYRow, Row, RowConfig } from "../EVYRow";
import RadioButton from "../design-system/RadioButton";

export default class InlinePickerRow extends EVYRow {
	static override config: RowConfig = {
		type: "InlinePicker",
		view: {
			content: {
				title: "Inline picker row title",
				format: "{$0.value}",
			},
			data: "",
		},
		edit: {
			destination: "{distance}",
			validation: {
				required: "true",
				message: "Please select a duration",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<div className="evy-p-2 evy-flex evy-gap-2">
					<RadioButton label="1 min" selected={false} />
					<RadioButton label="2 mins" selected />
					<RadioButton label="5 mins" selected={false} />
				</div>
			</div>
		);
	}
}
