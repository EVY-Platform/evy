import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
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
		title: "Input row title",
		placeholder: "placeholder",
		value: "",
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.title}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<Input
				value={row.config.value}
				placeholder={row.config.placeholder}
			/>
		</RowLayout>
	),
});
