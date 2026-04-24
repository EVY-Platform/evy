import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Dropdown from "../design-system/Dropdown";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("DropdownRow", {
	config: {
		type: "Dropdown",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Dropdown row title",
				placeholder: "placeholder",
				format: "{datum.value}",
			},
		},
		destination: "{condition}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<Dropdown
				value={row.config.source}
				placeholder={row.config.view.content.placeholder}
			/>
		</RowLayout>
	),
});
