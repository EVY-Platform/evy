import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class CalendarRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Calendar row title",
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
									?.value ?? "Calendar row title"}
							</p>
							<img
								src="/calendar.png"
								alt="calendar"
								className="evy-max-w-100 evy-block evy-pointer-events-none"
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
