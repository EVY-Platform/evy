import { ContainerChildren } from "../../components/ContainerChildren";
import { ContainerChildTemplate } from "../../components/ContainerChildTemplate";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "VerticalContainerRow";

export default defineRow(typeName, {
	config: {
		type: "VerticalContainer",
		actions: [],
		visible: "true",
		title: "Vertical container row title",
		children: [],
	} satisfies RowConfig,
	render: (row) => {
		const title = row.config.title;
		const source =
			typeof row.config.source === "string"
				? row.config.source
				: undefined;
		return (
			<RowLayout title={title} fullWidthContent>
				<ContainerChildTemplate
					childRowId={row.config.childRowId}
					source={source}
					orientation="vertical"
				/>
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
