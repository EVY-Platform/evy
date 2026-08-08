import { ContainerChildren } from "../../components/ContainerChildren";
import { SearchChildSample } from "../../components/SearchChildSample";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SearchRow", {
	config: {
		type: "search",
		actions: {},
		source: "",
		visible: "true",
		title: "Search row title",
		placeholder: "",
		no_results: "",
		destination: "",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-relative">
				<InlineIcon icon="::search::" alt="search" />
				<Input
					value={row.config.source ?? ""}
					placeholder={row.config.placeholder}
				/>
			</div>
			<ContainerChildren
				childIds={row.config.children_row_ids ?? []}
				orientation="vertical"
				showIndicators
				containerRowId={row.id}
				containerType="children"
			/>
			{row.config.child_row_id ? (
				<SearchChildSample
					searchRowId={row.id}
					childRowId={row.config.child_row_id}
				/>
			) : null}
		</RowLayout>
	),
});
