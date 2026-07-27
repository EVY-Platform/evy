import { ContainerChildren } from "../../components/ContainerChildren";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "VerticalContainerRow";

export default defineRow(typeName, {
	config: {
		type: "VerticalContainer",
		actions: {},
		visible: "true",
		title: "Vertical container row title",
	} satisfies RowConfig,
	render: (row) => {
		const title = row.config.title;
		return (
			<RowLayout title={title} fullWidthContent>
				<ContainerChildren
					childIds={row.config.childrenRowIds ?? []}
					orientation="vertical"
					showIndicators
					containerRowId={row.id}
					containerType="children"
				/>
			</RowLayout>
		);
	},
});
