import type { RowConfig } from "../types/row";
import { defineRow } from "./defineRow";
import { RowLayout } from "./design-system/RowLayout";

export const containerDropindicatorId = "placeholder";

export const UnknownRow = defineRow("UnknownRow", {
	config: {
		type: "Unknown",
		actions: [],
		view: {
			content: {
				title: "Unknown row",
			},
		},
	} satisfies RowConfig,
	render: (row) => <RowLayout title={row.config.view.content.title} />,
});
