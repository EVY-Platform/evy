import type { RowConfig } from "../../types/row";
import { defaultRowActions, defineRow } from "../defineRow";
import Button from "../design-system/Button";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("ButtonRow", {
	config: {
		type: "button",
		visible: "true",
		title: "",
		label: "Button row text",
		style: "primary",
		actions: defaultRowActions({ tap: { fn: "close" } }),
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-py-2 evy-flex evy-justify-center">
				<Button label={row.config.label} style={row.config.style} />
			</div>
		</RowLayout>
	),
});
