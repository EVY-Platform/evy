import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class CalendarRow extends EVYRow {
	static override config: RowConfig = {
		type: "Calendar",
		view: {
			content: {
				title: "",
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
						CalendarRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
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
