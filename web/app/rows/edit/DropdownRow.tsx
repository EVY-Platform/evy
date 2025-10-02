import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Dropdown from "../design-system/Dropdown";

export default class DropdownRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Dropdown row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Dropdown row placeholder",
		},
		{
			id: "value",
			type: "text",
			value: "Dropdown row value",
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
						<div className="evy-p-2">
							<p className="evy-pb-2">
								{row?.config.find((c) => c.id === "title")
									?.value ?? "Dropdown row title"}
							</p>
							<Dropdown
								value={
									row?.config.find((c) => c.id === "value")
										?.value ?? "Dropdown row value"
								}
								placeholder={
									row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Dropdown row placeholder"
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
