import { ContainerChildren } from "../../components/ContainerChildren";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "HorizontalContainerRow";

export default defineRow(typeName, {
	config: {
		type: "horizontal_container",
		actions: {},
		visible: "true",
		title: "Horizontal container row title",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-flex">
				<ContainerChildren
					childIds={row.config.children_row_ids ?? []}
					orientation="horizontal"
					showIndicators
					containerRowId={row.id}
					containerType="children"
				/>
			</div>
		</RowLayout>
	),
});
