import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TimeslotPickerRow", {
	config: {
		type: "TimeslotPicker",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Timeslot picker row title",
			},
		},
		destination: "",
	} satisfies RowConfig,
	render: (row) => <RowLayout title={row.config.view.content.title} />,
});
