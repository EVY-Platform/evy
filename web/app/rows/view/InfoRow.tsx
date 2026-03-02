import type { Row, RowConfig } from "../../types/row";
import { EVYRow } from "../EVYRow";

export default class InfoRow extends EVYRow {
	static override config: RowConfig = {
		type: "Info",
		view: {
			content: {
				title: "Info row title",
				text: "Info row info",
			},
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
