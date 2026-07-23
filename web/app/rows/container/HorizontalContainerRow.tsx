import { ContainerChildren } from "../../components/ContainerChildren";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "HorizontalContainerRow";

export default defineRow(typeName, {
	config: {
		type: "HorizontalContainer",
		actions: {},
		visible: "true",
		title: "Horizontal container row title",
		children: [],
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-flex">
				<ContainerChildren
					childIds={row.config.childrenRowIds ?? []}
					orientation="horizontal"
					showIndicators
					containerRowId={row.id}
					containerType="children"
				/>
			</div>
		</RowLayout>
	),
});
