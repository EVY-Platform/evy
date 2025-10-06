import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

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

	renderContent() {
		return (
			<AppContext.Consumer>
				{({ flows, activeFlowId }) => {
					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row =
						pages
							.flatMap((page) => page.rows)
							.find((r) => r.rowId === this.props.rowId) ??
						ColumnContainerRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<div className="evy-flex">
								{row.config.view.content.children?.map(
									(child) => (
										<div className="evy-flex-1">
											<p className="evy-text-md">
												{child.title}
											</p>
											{child.child.row}
										</div>
									)
								)}
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
