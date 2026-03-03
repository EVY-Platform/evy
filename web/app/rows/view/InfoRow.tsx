import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InfoRow", {
	config: {
		type: "Info",
		view: {
			content: {
				title: "Info row title",
				text: "Info row info",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<p className="evy-text-sm">{row.config.view.content.text}</p>
		</RowLayout>
	),
});
