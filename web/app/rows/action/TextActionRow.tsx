import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class TextActionRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Text action row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Placeholder",
		},
		{
			id: "action",
			type: "text",
			value: "Action",
		},
	];

	renderContent() {
		const rowId = this.props.rowId;

		return (
			<AppContext.Consumer>
				{({ flows, activeFlowId }) => {
					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row = pages
						.flatMap((page) => page.rowsData)
						.find((r) => r.rowId === rowId);

					return (
						<div className="evy-p-2">
							<p className="evy-pb-2">
								{row?.config.find((c) => c.id === "title")
									?.value ?? "Text action row title"}
							</p>
							<div className="evy-flex evy-justify-between">
								<p>
									{row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Placeholder"}
								</p>
								<button
									type="button"
									className="evy-text-blue evy-text-sm evy-hover\:text-black evy-bg-transparent evy-border-none"
								>
									{row?.config.find((c) => c.id === "action")
										?.value ?? "Action"}
								</button>
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
