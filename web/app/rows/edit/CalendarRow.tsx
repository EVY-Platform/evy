import type { Row, RowConfig } from "../../types/row";
import { EVYRow } from "../EVYRow";

export default class CalendarRow extends EVYRow {
	static override config: RowConfig = {
		type: "Calendar",
		view: {
			content: {
				title: "Calendar row title",
				primary: "{item.transfer_options.pickup.timeslots}",
				secondary: "{item.transfer_options.delivery.timeslots}",
			},
		},
		edit: {
			destination: "{item.transfer_options.pickup.timeslots}",
			validation: {
				required: "true",
				message: "Please select available times",
				minAmount: "1",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<img
					src="/calendar.png"
					alt="calendar"
					className="evy-max-w-100 evy-block evy-pointer-events-none"
				/>
			</div>
		);
	}
}
