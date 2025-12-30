import { EVYRow, type Row, type RowConfig } from "../EVYRow";

export default class TextRow extends EVYRow {
	static override config: RowConfig = {
		type: "Text",
		view: {
			content: {
				title: "Text row title",
				text: "placeholder",
			},
			max_lines: "",
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<p className="evy-text-sm">{row.config.view.content.text}</p>
			</div>
		);
	}
}
