import { defineRow } from "./defineRow";
import { RowLayout } from "./design-system/RowLayout";

export const UnknownRow = defineRow("UnknownRow", {
	config: {
		type: "text",
		actions: {},
		visible: "true",
		title: "Unknown row",
	},
	render: (row) => <RowLayout title={row.config.title} />,
});
