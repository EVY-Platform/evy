import { ContainerChildren } from "../../components/ContainerChildren";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "ListContainerRow";

export default defineRow(typeName, {
	config: {
		type: "ListContainer",
		actions: [],
		visible: "true",
		title: "List container row title",
		child: undefined,
		children: [],
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
