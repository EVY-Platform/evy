import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class InfoRow extends EVYRow {
	static override config: RowConfig = {
		type: "Info",
		view: {
			content: {
				title: "Info row title",
				text: "Info row info",
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
							.flatMap((page) => page.rowsData)
							.find((r) => r.rowId === this.props.rowId) ??
						InfoRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<p>{row.config.view.content.text}</p>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
