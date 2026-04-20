import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("CalendarRow", {
	config: {
		type: "Calendar",
		actions: [],
		source: "{item}",
		view: {
			content: {
				title: "Calendar row title",
				primary: "{item.transfer_options.pickup.timeslots}",
				secondary: "{item.transfer_options.delivery.timeslots}",
			},
		},
		destination: "{pickup_timeslots}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<img
				src="/calendar.png"
				alt="calendar"
				className="evy-block evy-pointer-events-none"
				style={{ maxWidth: "100%" }}
			/>
		</RowLayout>
	),
});
