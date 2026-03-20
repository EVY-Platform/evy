import type { RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";

const typeName = "ListContainerRow";

export default defineRow(typeName, {
	config: {
		type: "ListContainer",
		actions: [],
		view: {
			content: {
				title: "List container row title",
				children: [],
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const title = row.config.view.content.title;
		return (
			<div className="evy-flex evy-flex-col">
				{title ? (
					<p className="evy-text-md evy-p-2">
						<EVYText text={title} />
					</p>
				) : null}
				<ContainerChildren
					rows={row.config.view.content.children}
					orientation="vertical"
					showIndicators
					showPlaceholder={row.id !== typeName}
				/>
			</div>
		);
	},
});
