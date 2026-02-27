import type { Row, RowConfig } from "../types/row";
import { EVYRow } from "../EVYRow";
import Button from "../design-system/Button";

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
					<Button
						label={
							typeof row.config.view.content.label === "string"
								? row.config.view.content.label
								: ""
						}
					/>
				</div>
			</div>
		);
	}
}
