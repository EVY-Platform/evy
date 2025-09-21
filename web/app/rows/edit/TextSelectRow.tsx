import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Checkbox from "../design-system/Checkbox";

export default class TextSelectRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Text select row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Text select row placeholder",
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
									?.value ?? "Text select row title"}
							</p>
							<div className="flex justify-between">
								<p className="text-evy-light">
									{row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Text select row placeholder"}
								</p>
								<Checkbox checked={false} />
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
