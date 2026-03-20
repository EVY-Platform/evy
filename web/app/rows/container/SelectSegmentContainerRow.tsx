import type { CSSProperties } from "react";
import { useState } from "react";

import type { Row, RowConfig } from "../../types/row";
import { ContainerChildren } from "../../components/ContainerChildren";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { useRowById } from "../../hooks/useRowById";

const typeName = "SelectSegmentContainerRow";

const firstSegmentStyle: CSSProperties = {
	borderTopLeftRadius: "var(--radius-md)",
	borderBottomLeftRadius: "var(--radius-md)",
	borderRightWidth: "0px",
};

const lastSegmentStyle: CSSProperties = {
	borderTopRightRadius: "var(--radius-md)",
	borderBottomRightRadius: "var(--radius-md)",
	borderLeftWidth: "0px",
};

const segmentGroupStyle: CSSProperties = {
	borderRadius: "999px",
};

export default defineRow(typeName, {
	config: {
		type: "SelectSegmentContainer",
		actions: [],
		view: {
			content: {
				title: "Select segment container row title",
				segments: ["X", "Y", "Z"],
				children: [],
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

		const title = row.config.view.content.title;

		return (
			<>
				{title ? (
					<p className="evy-text-md evy-p-2">
						<EVYText text={title} />
					</p>
				) : null}
				<div className="evy-flex evy-mb-2 evy-px-2" style={segmentGroupStyle}>
					{segments.map((segment, index) => {
						const isFirst = index === 0;
						const isLast = index === segments.length - 1;
						return (
							<button
								key={segment}
								type="button"
								onClick={() => setSelectedTab(index)}
								className={`evy-flex-1 evy-border ${selectedTab === index ? "evy-bg-gray-light" : "evy-bg-white"}`}
								style={{
									...(isFirst && firstSegmentStyle),
									...(isLast && lastSegmentStyle),
								}}
							>
								{segment}
							</button>
						);
					})}
				</div>
				<ContainerChildren
					rows={rowsToShow}
					showPlaceholder={row.id !== typeName}
				/>
			</>
		);
	},
});
