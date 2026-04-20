import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Button from "../design-system/Button";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("ButtonRow", {
	config: {
		type: "Button",
		source: "",
		view: {
			content: {
				title: "",
				label: "Button row text",
			},
		},
		actions: [{ condition: "", false: "", true: "close" }],
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-p-2 evy-flex evy-justify-center">
				<Button
					label={
						typeof row.config.view.content.label === "string"
							? row.config.view.content.label
							: ""
					}
				/>
			</div>
		</RowLayout>
	),
});
