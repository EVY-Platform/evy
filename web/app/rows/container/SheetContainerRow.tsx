import { DraggableRowContainer } from "../../components/DraggableRowContainer";
import { EVYRow, type Row, type RowConfig } from "../EVYRow";

export default class SheetContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "SheetContainer",
		view: {
			content: {
				title: "Sheet container row title",
				children: [],
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-gap-2">
					{row.config.view.content.child && (
						<DraggableRowContainer rowId={row.config.view.content.child.rowId}>
							{row.config.view.content.child.row}
						</DraggableRowContainer>
					)}
				</div>
			</div>
		);
	}
}
