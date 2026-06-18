import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InputRow", {
	config: {
		type: "Input",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Input row title",
				placeholder: "placeholder",
				value: "",
			},
		},
		destination: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.title}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<Input
				value={row.config.view.content.value}
				placeholder={row.config.view.content.placeholder}
			/>
		</RowLayout>
	),
});
