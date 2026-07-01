import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Button from "../design-system/Button";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("ButtonRow", {
	config: {
		type: "Button",
		visible: "true",
		title: "",
		label: "Button row text",
		actions: [{ condition: "", false: "", true: "{close()}" }],
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-py-2 evy-flex evy-justify-center">
				<Button label={row.config.label} />
			</div>
		</RowLayout>
	),
});
