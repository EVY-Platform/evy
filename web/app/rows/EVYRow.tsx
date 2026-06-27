import { defineRow } from "./defineRow";
import { RowLayout } from "./design-system/RowLayout";

export const containerDropindicatorId = "placeholder";

export const UnknownRow = defineRow("UnknownRow", {
	config: {
		type: "Text",
		actions: [],
		source: "",
		title: "Unknown row",
	},
	render: (row) => <RowLayout title={row.config.title} />,
});
