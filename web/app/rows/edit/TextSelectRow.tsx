import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Checkbox from "../design-system/Checkbox";

export default class TextSelectRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextSelect",
		view: {
			content: {
				title: "Text select row title",
				text: "placeholder",
			},
		},
		edit: {
			destination: "{item.payment_methods.cash}",
			validation: {
				required: "true",
				message: "Please make a selection",
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
						TextSelectRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<div className="evy-flex evy-justify-between">
								<p>{row.config.view.content.text}</p>
								<Checkbox checked={false} />
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
