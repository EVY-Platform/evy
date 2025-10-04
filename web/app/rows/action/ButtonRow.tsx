import Button from "../design-system/Button";
import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class ButtonRow extends EVYRow {
	static override config: RowConfig = {
		type: "Button",
		view: {
			content: {
				title: "Button row title",
				label: "Button row text",
			},
		},
		action: {
			target: "close",
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
						ButtonRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<div className="evy-p-2 evy-flex evy-justify-center">
								<Button label={row.config.view.content.label} />
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
