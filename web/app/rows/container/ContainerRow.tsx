import { EVYRow, Row, RowConfig } from "../EVYRow";

export default class ContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "Container",
		view: {
			content: {
				title: "Container row title",
				child: undefined,
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div>
				<p>{row.config.view.content.title}</p>
				<div>{row.config.view.content.child?.row}</div>
			</div>
		);
	}
}
