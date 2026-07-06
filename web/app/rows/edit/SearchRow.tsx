import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SearchRow", {
	config: {
		type: "Search",
		actions: [],
		source: "",
		visible: "true",
		title: "Search row title",
		placeholder: "placeholder",
		destination: "{address}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-relative">
				<InlineIcon icon="::search::" alt="Search" />
				<Input
					value={row.config.source ?? ""}
					placeholder={row.config.placeholder}
				/>
			</div>
		</RowLayout>
	),
});
