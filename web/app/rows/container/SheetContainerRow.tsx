import { EVYRow, Row, RowConfig } from "../EVYRow";
import { DraggableRowContainer } from "../../components/DraggableRowContainer";

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
						<DraggableRowContainer
							rowId={row.config.view.content.child.rowId}
						>
							{row.config.view.content.child.row}
						</DraggableRowContainer>
					)}
				</div>
			</div>
		);
	}
}
