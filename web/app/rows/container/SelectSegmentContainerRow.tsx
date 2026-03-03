import { useState } from "react";

import type { Row, RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";
import { useRowById } from "../../hooks/useRowById";

const typeName = "SelectSegmentContainerRow";

export default defineRow(typeName, {
	config: {
		type: "SelectSegmentContainer",
		view: {
			content: {
				title: "Select segment container row title",
				segments: ["X", "Y", "Z"],
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
	Component: function SelectSegmentContainerRowInner({
		rowId,
	}: {
		rowId: string;
	}) {
		const row = useRowById(rowId);
		const [selectedTab, setSelectedTab] = useState(0);

		if (!row) {
			return null;
		}

		const rawSegments = row.config.view.content.segments;
		const segments: string[] =
			Array.isArray(rawSegments) &&
			rawSegments.every((x): x is string => typeof x === "string")
				? rawSegments
				: [];
		const rawChildren = row.config.view.content.children;
		const children: Row[] = Array.isArray(rawChildren) ? rawChildren : [];
		const selectedChild = children[selectedTab];
		const rowsToShow =
			selectedChild !== undefined ? [selectedChild] : undefined;

		return (
			<RowLayout title={row.config.view.content.title}>
				<div className="evy-rounded-full evy-flex evy-mb-2">
					{segments.map((segment, index) => (
						<button
							key={segment}
							type="button"
							onClick={() => setSelectedTab(index)}
							className={`evy-flex-1 evy-border ${
								index === 0 ? "evy-rounded-left-md evy-border-r-0" : ""
							} ${
								index === segments.length - 1
									? "evy-rounded-right-md evy-border-l-0"
									: ""
							} ${selectedTab === index ? "evy-bg-gray-light" : "evy-bg-white"}`}
						>
							{segment}
						</button>
					))}
				</div>
				<ContainerChildren
					rows={rowsToShow}
					showPlaceholder={row.id !== typeName}
				/>
			</RowLayout>
		);
	},
});
