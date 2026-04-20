import type { RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "ColumnContainerRow";

export default defineRow(typeName, {
	config: {
		type: "ColumnContainer",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Column container row title",
				children: [],
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex">
				<ContainerChildren
					rows={row.config.view.content.children}
					orientation="horizontal"
					showIndicators
					showPlaceholder={row.id !== typeName}
				/>
			</div>
		</RowLayout>
	),
});
