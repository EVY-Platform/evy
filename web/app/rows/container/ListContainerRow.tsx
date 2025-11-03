import { EVYRow, Row, RowConfig } from "../EVYRow";
import { DraggableRowContainer } from "../../components/DraggableRowContainer";

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
					{row.config.view.content.children?.map((child, index) => (
						<DraggableRowContainer
							key={child.rowId}
							rowId={child.rowId}
							showDropzoneBefore={index === 0}
							showDropzoneAfter
						>
							{child.row}
						</DraggableRowContainer>
					))}
				</div>
			</div>
		);
	}
}
