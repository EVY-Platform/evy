import {
	DraggableRowContainer,
	PlaceholderDropIndicator,
} from "../../components/DraggableRowContainer";
import { EVYRow, type Row, type RowConfig } from "../EVYRow";

export default class SheetContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "SheetContainer",
		view: {
			content: {
				title: "Sheet container row title",
				child: undefined,
				children: [],
			},
		},
	};

	renderContent(row: Row) {
		const childElement = row.config.view.content.child ? (
			<DraggableRowContainer rowId={row.config.view.content.child.rowId}>
				{row.config.view.content.child.row}
			</DraggableRowContainer>
		) : (
			// We don't want to show dropzone in row list
			row.rowId !== this.constructor.name && <PlaceholderDropIndicator />
		);
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-gap-2">{childElement}</div>
			</div>
		);
	}
}
