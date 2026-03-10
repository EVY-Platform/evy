import type { RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

const typeName = "SheetContainerRow";

export default defineRow(typeName, {
	config: {
		type: "SheetContainer",
		actions: [],
		view: {
			content: {
				title: "Sheet container row title",
				child: undefined,
				children: [],
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const child = row.config.view.content.child;
		const rows = child ? [child] : undefined;

		return (
			<RowLayout title={row.config.view.content.title}>
				<div className="evy-flex evy-gap-2">
					<ContainerChildren
						rows={rows}
						showPlaceholder={row.id !== typeName}
					/>
				</div>
			</RowLayout>
		);
	},
});
