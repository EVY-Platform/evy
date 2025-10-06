import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class ContainerRow extends EVYRow {
	static override config: RowConfig = {
		type: "Container",
		view: {
			content: {
				title: "Container row title",
				child: undefined,
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
						ContainerRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<div className="evy-flex">
								<p className="evy-text-md">
									{row.config.view.content.title}
								</p>
								{row.config.view.content.child?.row}
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
