import { EVYRow, Row, RowConfig } from "../EVYRow";

interface SelectSegmentContainerState {
	selectedTab: number;
}

export default class SelectSegmentContainerRow extends EVYRow {
	override state: SelectSegmentContainerState;

	static override config: RowConfig = {
		type: "SelectSegmentContainer",
		view: {
			content: {
				title: "Select segment container row title",
				children: [],
			},
		},
	};

	constructor(props: { rowId: string }) {
		super(props);
		this.state = {
			selectedTab: 0,
		};
	}

	renderContent(row: Row) {
		const children = row.config.view.content.children || [];

		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
				<div className="evy-rounded-full evy-flex evy-gap-0">
					{children.map((child, index) => (
						<button
							key={child.rowId}
							type="button"
							onClick={() =>
								this.setState({ selectedTab: index })
							}
							className={`evy-flex-1 evy-border ${
								index === 0
									? "evy-rounded-left-md evy-border-r-0"
									: ""
							} ${
								index === children.length - 1
									? "evy-rounded-right-md evy-border-l-0"
									: ""
							} ${
								this.state.selectedTab === index
									? "evy-bg-gray-light"
									: "evy-bg-white"
							}`}
						>
							{child.config.view.content.title}
						</button>
					))}
				</div>
				<div className="evy-flex evy-flex-col evy-gap-2 evy-mt-2">
					{children[this.state.selectedTab]?.row}
				</div>
			</div>
		);
	}
}
