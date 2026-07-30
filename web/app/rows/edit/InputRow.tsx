import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InputRow", {
	config: {
		type: "input",
		actions: {},
		source: "",
		visible: "true",
		title: "Input row title",
		placeholder: "placeholder",
		destination: "{resourceId.title}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<Input
				value={row.config.source ?? ""}
				placeholder={row.config.placeholder}
			/>
		</RowLayout>
	),
});
