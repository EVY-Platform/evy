import { EVYRow, Row, RowConfig } from "../EVYRow";
import { DraggableRowContainer } from "../../components/DraggableRowContainer";

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
		const rows = row.config.view.content.children;
		const lastIndex = rows && rows.length > 0 ? rows.length - 1 : 0;
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex">
					{rows?.map((child, index) => (
						<DraggableRowContainer
							key={child.rowId}
							rowId={child.rowId}
							orientation="horizontal"
							showIndicators
							previousRowId={
								index > 0 ? rows[index - 1].rowId : undefined
							}
							nextRowId={
								index < lastIndex
									? rows[index + 1].rowId
									: undefined
							}
						>
							{child.row}
						</DraggableRowContainer>
					))}
				</div>
			</div>
		);
	}
}
