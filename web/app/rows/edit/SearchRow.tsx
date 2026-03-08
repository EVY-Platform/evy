import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SearchRow", {
	config: {
		type: "Search",
		actions: [],
		view: {
			content: {
				title: "Search row title",
				format: "{$0.value}",
				placeholder: "placeholder",
			},
			data: "",
		},
		destination: "{address}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-relative">
				<InlineIcon icon="/search.svg" alt="Search" />
				<Input
					value={row.config.view.data ?? ""}
					placeholder={row.config.view.content.placeholder ?? ""}
					offset="left"
				/>
			</div>
		</RowLayout>
	),
});
