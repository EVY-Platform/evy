import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import RadioButton from "../design-system/RadioButton";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InlinePickerRow", {
	config: {
		type: "InlinePicker",
		actions: [],
		view: {
			content: {
				title: "Inline picker row title",
				format: "{$0.value}",
			},
			data: "",
		},
		destination: "{distance}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-p-2 evy-flex evy-gap-2">
				<RadioButton label="1 min" selected={false} />
				<RadioButton label="2 mins" selected />
				<RadioButton label="5 mins" selected={false} />
			</div>
		</RowLayout>
	),
});
