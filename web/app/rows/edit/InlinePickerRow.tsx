import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import RadioButton from "../design-system/RadioButton";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InlinePickerRow", {
	config: {
		type: "InlinePicker",
		actions: [],
		source: "{e82e1baa-6d33-4649-b495-4e10a4d1d8bf}",
		visible: "true",
		view: {
			content: {
				title: "Inline picker row title",
				format: "{$datum.value}",
			},
		},
		destination: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.distance}",
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
