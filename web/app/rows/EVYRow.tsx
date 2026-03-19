import { defineRow } from "./defineRow";
import { RowLayout } from "./design-system/RowLayout";

export const containerDropindicatorId = "placeholder";

export const UnknownRow = defineRow("UnknownRow", {
	config: {
		type: "Text",
		actions: [],
		view: {
			content: {
				title: "Unknown row",
			},
		},
	},
	render: (row) => <RowLayout title={row.config.view.content.title} />,
});
