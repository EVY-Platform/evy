import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class TextActionRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextAction",
		view: {
			content: {
				title: "Text action row title",
				text: "Placeholder",
				placeholder: "Enter pick up address",
				action: "Change",
			},
		},
		edit: {
			destination: "{item.transfer_options.pickup.address}",
			validation: {
				required: "true",
				message: "Please provide an address",
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
						TextActionRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<div className="evy-flex evy-justify-between">
								<p>{row.config.view.content.text}</p>
								<button
									type="button"
									className="evy-text-blue evy-text-sm evy-hover\:text-black evy-bg-transparent evy-border-none"
								>
									{row.config.view.content.action}
								</button>
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
