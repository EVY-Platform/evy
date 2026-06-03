import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("CalendarRow", {
	config: {
		type: "Calendar",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Calendar row title",
				start_time: "07:00",
				end_time: "19:00",
				timeslot_interval_minutes: 30,
				label_interval_minutes: 60,
				header_format: '{formatDatetime($datum, "EEE d")}',
				timeslot_format: '{formatDatetime($datum, "HH:mm")}',
				primary: "{pickup_selection}",
				secondary: "{delivery_selection}",
			},
		},
		destination: "{item.pickup_selection}",
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
