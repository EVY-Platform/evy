import { EVYRow, Row, RowConfig } from "../EVYRow";

export default class ColumnContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "ColumnContainer",
		view: {
			content: {
				title: "Column container row title",
				children: [],
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-gap-2">
					{row.config.view.content.children?.map(
						(child) => child.row
					)}
				</div>
			</div>
		);
	}
}
