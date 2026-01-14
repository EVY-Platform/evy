import {
	DraggableRowContainer,
	PlaceholderDropIndicator,
} from "../../components/DraggableRowContainer";
import { EVYRow, type Row, type RowConfig } from "../EVYRow";

interface SelectSegmentContainerState {
	selectedTab: number;
}

export default class SelectSegmentContainerRow extends EVYRow {
	override state: SelectSegmentContainerState = { selectedTab: 0 };

	static override config: RowConfig = {
		type: "SelectSegmentContainer",
		view: {
			content: {
				title: "Select segment container row title",
				segments: ["X", "Y", "Z"],
				children: [],
			},
		},
	};

	renderContent(row: Row) {
		const segments = row.config.view.content.segments as string[];
		const children = row.config.view.content.children as Row[];

		const childrenElements = children.length ? (
			<DraggableRowContainer
				rowId={children[this.state.selectedTab].rowId}
			>
				{children[this.state.selectedTab].row}
			</DraggableRowContainer>
		) : (
			// We don't want to show dropzone in rows panel
			row.rowId !== this.constructor.name && <PlaceholderDropIndicator />
		);

		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-rounded-full evy-flex evy-mb-2">
					{segments.map((segment, index) => (
						<button
							key={segment}
							type="button"
							onClick={() =>
								this.setState({ selectedTab: index })
							}
							className={`evy-flex-1 evy-border ${
								index === 0
									? "evy-rounded-left-md evy-border-r-0"
									: ""
							} ${
								index === segments.length - 1
									? "evy-rounded-right-md evy-border-l-0"
									: ""
							} ${
								this.state.selectedTab === index
									? "evy-bg-gray-light"
									: "evy-bg-white"
							}`}
						>
							{segment}
						</button>
					))}
				</div>
				{childrenElements}
			</div>
		);
	}
}
