import type { Row, RowConfig } from "../../types/row";
import { EVYRow } from "../EVYRow";
import Checkbox from "../design-system/Checkbox";

export default class TextSelectRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextSelect",
		view: {
			content: {
				title: "Text select row title",
				text: "placeholder",
			},
		},
		edit: {
			destination: "{item.payment_methods.cash}",
			validation: {
				required: "true",
				message: "Please make a selection",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<div className="evy-flex evy-justify-between">
					<p className="evy-text-sm">{row.config.view.content.text}</p>
					<Checkbox checked={false} />
				</div>
			</div>
		);
	}
}
