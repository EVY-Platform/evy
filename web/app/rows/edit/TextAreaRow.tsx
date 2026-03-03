import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import TextArea from "../design-system/TextArea";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextAreaRow", {
	config: {
		type: "TextArea",
		view: {
			content: {
				title: "Text area row title",
				value: "",
				placeholder: "placeholder",
			},
		},
		edit: {
			destination: "{item.description}",
			validation: {
				required: "true",
				message: "Please provide a description",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<TextArea
				value={row.config.view.content.value ?? ""}
				placeholder={row.config.view.content.placeholder ?? ""}
			/>
		</RowLayout>
	),
});
