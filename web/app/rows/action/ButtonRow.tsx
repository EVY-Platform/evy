import Button from "../design-system/Button";
import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class ButtonRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "text",
			type: "text",
			value: "Button row text",
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
						<div className="evy-p-2 evy-flex evy-justify-center">
							<Button
								label={
									row?.config.find((c) => c.id === "text")
										?.value ?? "Button row text"
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
