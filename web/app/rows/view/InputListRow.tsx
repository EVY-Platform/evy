import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InputListRow", {
	config: {
		type: "InputList",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Input list row title",
				placeholder: "Search for tags",
				format: "{datum.value}",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<Input
				value={row.config.source}
				placeholder={row.config.view.content.placeholder ?? ""}
			/>
		</RowLayout>
	),
});
