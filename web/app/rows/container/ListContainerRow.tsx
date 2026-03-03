import type { RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "ListContainerRow";

export default defineRow(typeName, {
	config: {
		type: "ListContainer",
		view: {
			content: {
				title: "List container row title",
				children: [],
			},
		},
		edit: {
			destination: "",
			validation: {
				required: "false",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-flex-col">
				<ContainerChildren
					rows={row.config.view.content.children}
					orientation="vertical"
					showIndicators
					showPlaceholder={row.id !== typeName}
				/>
			</div>
		</RowLayout>
	),
});
