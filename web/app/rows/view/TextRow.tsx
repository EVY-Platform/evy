import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class TextRow extends EVYRow {
	static override config: RowConfig = {
		type: "Text",
		view: {
			content: {
				title: "Text row title",
				text: "Text row placeholder",
			},
			max_lines: "",
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
						TextRow;

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
