import type { Row, RowConfig } from "../types/row";
import { EVYRow } from "../EVYRow";

export default class TextActionRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextAction",
		view: {
			content: {
				title: "Text action row title",
				text: "Placeholder",
				placeholder: "Enter pick up address",
				action: "Change",
			},
		},
		edit: {
			destination: "{item.transfer_options.pickup.address}",
			validation: {
				required: "true",
				message: "Please provide an address",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-justify-between">
					<p className="evy-text-md">{row.config.view.content.text}</p>
					<button
						type="button"
						className="evy-text-blue evy-text-sm evy-hover:text-black evy-bg-transparent evy-border-none"
					>
						{row.config.view.content.action}
					</button>
				</div>
			</div>
		);
	}
}
