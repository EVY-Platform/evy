import Button from "../design-system/Button";
import { EVYRow, type Row, type RowConfig } from "../EVYRow";

export default class ButtonRow extends EVYRow {
	static override config: RowConfig = {
		type: "Button",
		view: {
			content: {
				title: "",
				label: "Button row text",
			},
		},
		action: {
			target: "close",
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<div className="evy-p-2 evy-flex evy-justify-center">
					<Button label={row.config.view.content.label as string} />
				</div>
			</div>
		);
	}
}
