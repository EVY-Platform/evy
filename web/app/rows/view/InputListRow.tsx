import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Input from "../design-system/Input";

export default class InputListRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Input list row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Input placeholder",
		},
		{
			id: "value",
			type: "text",
			value: "Input value",
		},
	];

	renderContent() {
		const rowId = this.props.rowId;

		return (
			<AppContext.Consumer>
				{({ pages }) => {
					const row = pages
						.flatMap((page) => page.rowsData)
						.find((r) => r.rowId === rowId);

					return (
						<div className="p-2">
							<p className="pb-2">
								{row?.config.find((c) => c.id === "title")
									?.value ?? "Input list row title"}
							</p>
							<Input
								value={
									row?.config.find((c) => c.id === "value")
										?.value ?? "Input list row value"
								}
								placeholder={
									row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Input list row placeholder"
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
