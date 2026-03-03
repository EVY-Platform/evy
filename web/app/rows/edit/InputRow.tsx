import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InputRow", {
	config: {
		type: "Input",
		view: {
			content: {
				title: "Input row title",
				placeholder: "placeholder",
				value: "",
			},
		},
		edit: {
			destination: "{item.title}",
			validation: {
				required: "true",
				message: "This field is required",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<Input
				value={row.config.view.content.value?.toString() ?? ""}
				placeholder={row.config.view.content.placeholder?.toString() ?? ""}
			/>
		</RowLayout>
	),
});
