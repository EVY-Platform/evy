import { EVYRow, Row, RowConfig } from "../EVYRow";

export default class ListContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "ListContainer",
		view: {
			content: {
				title: "List container row title",
				children: [],
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-flex-col">
					{row.config.view.content.children?.map(
						(child) => child.row
					)}
				</div>
			</div>
		);
	}
}
