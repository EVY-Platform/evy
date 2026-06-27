import { ContainerChildren } from "../../components/ContainerChildren";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "ColumnContainerRow";

export default defineRow(typeName, {
	config: {
		type: "ColumnContainer",
		actions: [],
		source: "",
		visible: "true",
		title: "Column container row title",
		children: [],
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-flex">
				<ContainerChildren
					rows={row.config.children}
					orientation="horizontal"
					showIndicators
					containerRowId={row.id}
					containerType="children"
				/>
			</div>
		</RowLayout>
	),
});
