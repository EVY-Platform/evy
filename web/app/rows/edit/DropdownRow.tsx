import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Dropdown from "../design-system/Dropdown";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("DropdownRow", {
	config: {
		type: "Dropdown",
		actions: [],
		source: "{cc2e6c74-a53a-4ed1-97a7-14aa9b9a3e3f}",
		visible: "true",
		view: {
			content: {
				title: "Dropdown row title",
				placeholder: "placeholder",
				format: "{$datum.value}",
			},
		},
		destination: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.condition}",
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
