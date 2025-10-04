import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import RadioButton from "../design-system/RadioButton";

export default class InlinePickerRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Inline picker row title",
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
									?.value ?? "Inline picker row title"}
							</p>
							<div className="evy-p-2 evy-flex evy-gap-2">
								<RadioButton label="1 min" selected={false} />
								<RadioButton label="2 mins" selected={true} />
								<RadioButton label="5 mins" selected={false} />
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
