import { DraggableRowContainer } from "../../components/DraggableRowContainer";
import { PlaceholderDropIndicator } from "../../components/PlaceholderDropIndicator";
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
			<DraggableRowContainer
				key={row.config.view.content.child.id}
				rowId={row.config.view.content.child.id}
			>
				{row.config.view.content.child.row}
			</DraggableRowContainer>
		) : // We don't want to show dropzone in rows panel
		row.id !== this.constructor.name ? (
			<PlaceholderDropIndicator key="placeholder" />
		) : null;
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-flex evy-gap-2">{childElement}</div>
			</div>
		);
	}
}
