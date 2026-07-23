import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";
import TextArea from "../design-system/TextArea";

export default defineRow("TextAreaRow", {
	config: {
		type: "TextArea",
		actions: {},
		source: "",
		visible: "true",
		title: "Text area row title",
		placeholder: "placeholder",
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.description}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<TextArea
				value={row.config.source ?? ""}
				placeholder={row.config.placeholder}
			/>
		</RowLayout>
	),
});
