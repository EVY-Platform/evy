import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Dropdown from "../design-system/Dropdown";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("DropdownRow", {
	config: {
		type: "Dropdown",
		actions: [],
		source: `{${MARKETPLACE_RESOURCE.CONDITIONS}}`,
		visible: "true",
		title: "Dropdown row title",
		placeholder: "placeholder",
		value: "{$datum.value}",
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.condition}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<Dropdown
				value={row.config.source}
				placeholder={row.config.placeholder}
			/>
		</RowLayout>
	),
});
