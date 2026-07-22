import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import type { RowConfig } from "../../types/row";
import { defineRow, tapAction } from "../defineRow";
import RadioButton from "../design-system/RadioButton";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("InlinePickerRow", {
	config: {
		type: "InlinePicker",
		actions: [tapAction("{select($datum)}")],
		source: `{${MARKETPLACE_RESOURCE.DURATIONS}}`,
		visible: "true",
		title: "Inline picker row title",
		value: "{$datum.value}",
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.distance}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-p-2 evy-flex evy-gap-2">
				<RadioButton label="1 min" selected={false} />
				<RadioButton label="2 mins" selected />
				<RadioButton label="5 mins" selected={false} />
			</div>
		</RowLayout>
	),
});
