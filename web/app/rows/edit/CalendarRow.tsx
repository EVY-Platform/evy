import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("CalendarRow", {
	config: {
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
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<img
				src="/calendar.png"
				alt="calendar"
				className="evy-max-w-100 evy-block evy-pointer-events-none"
			/>
		</RowLayout>
	),
});
