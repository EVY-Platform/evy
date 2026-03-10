import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Checkbox from "../design-system/Checkbox";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextSelectRow", {
	config: {
		type: "TextSelect",
		actions: [],
		view: {
			content: {
				title: "Text select row title",
				text: "placeholder",
			},
		},
		destination: "{payment_cash}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-justify-between">
				<p className="evy-text-sm">{row.config.view.content.text}</p>
				<Checkbox checked={false} />
			</div>
		</RowLayout>
	),
});
