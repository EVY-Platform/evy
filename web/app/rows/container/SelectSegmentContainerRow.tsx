import { type CSSProperties, type MouseEvent, useState } from "react";
import { ContainerChildren } from "../../components/ContainerChildren";
import { useRowById } from "../../hooks/useRowById";
import { useFlowsContext } from "../../state/contexts/FlowsContext";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

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
	borderRadius: "var(--radius-md)",
};

export default defineRow(typeName, {
	config: {
		type: "SelectSegmentContainer",
		actions: [],
		visible: "true",
		title: "Select segment container row title",
		segments: ["X", "Y", "Z"],
		children: [],
	} satisfies RowConfig,
	Component: function SelectSegmentContainerRowInner({
		rowId,
	}: {
		rowId: string;
	}) {
		const row = useRowById(rowId);
		const { activeRowId, configStack, dispatchRow } = useFlowsContext();
		const [selectedTab, setSelectedTab] = useState(0);

		if (!row) {
			return null;
		}

		const rawSegments = row.config.segments;
		const segments: string[] =
			Array.isArray(rawSegments) &&
			rawSegments.every((x): x is string => typeof x === "string")
				? rawSegments
				: [];
		const childrenRowIds = row.config.childrenRowIds ?? [];

		// Segment button handler: stop propagation so the click doesn't bubble to
		// RowPrimitive and trigger the generic row-toggle, then ensure the container
		// row stays active.
		const selectSegment = (
			event: MouseEvent<HTMLButtonElement>,
			index: number,
		) => {
			event.stopPropagation();
			setSelectedTab(index);
			const isContainerAlreadyActiveWithNoChildSelected =
				activeRowId === rowId && configStack.length === 0;
			if (!isContainerAlreadyActiveWithNoChildSelected) {
				dispatchRow({ type: "SET_ACTIVE_ROW", rowId });
			}
		};

		const activeRowPath = activeRowId ? [activeRowId, ...configStack] : [];
		const rowPathIndex = activeRowPath.indexOf(rowId);
		const activeDirectChildId =
			rowPathIndex >= 0 ? activeRowPath[rowPathIndex + 1] : undefined;
		const activeDirectChildIndex = childrenRowIds.indexOf(
			activeDirectChildId ?? "",
		);
		const visibleChildIndex =
			activeDirectChildIndex >= 0 ? activeDirectChildIndex : selectedTab;

		const selectedChildId = childrenRowIds[visibleChildIndex];

		const title = row.config.title;

		return (
			<RowLayout title={title} fullWidthContent>
				<div
					className="evy-flex evy-mb-2 evy-px-2"
					style={segmentGroupStyle}
				>
					{segments.map((segment, index) => {
						const isFirst = index === 0;
						const isLast = index === segments.length - 1;
						return (
							<button
								key={segment}
								type="button"
								onClick={(e) => selectSegment(e, index)}
								className={`evy-flex-1 evy-border ${visibleChildIndex === index ? "evy-bg-gray-light" : "evy-bg-white"}`}
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
					childIds={
						selectedChildId !== undefined ? [selectedChildId] : []
					}
					containerRowId={rowId}
					containerType="children"
				/>
			</RowLayout>
		);
	},
});
