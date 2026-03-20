import { useContext, useMemo, useRef } from "react";

import { AppContext } from "../state";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useSelectRow } from "../hooks/useSelectRow";
import { buildRowElements } from "./buildRowElements";
import { baseTitleStyle, rounded24Style } from "./pageStyles";
import { findRowInPages } from "../utils/rowTree";

export default function SecondarySheetPage({
	sheetRowId,
}: {
	sheetRowId: string;
}) {
	const { flows, activeFlowId, dispatchRow, dispatchDropIndicator } =
		useContext(AppContext);
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const sheetRow = useMemo(() => {
		const pages = flows.find((f) => f.id === activeFlowId)?.pages ?? [];
		return findRowInPages(sheetRowId, pages);
	}, [flows, activeFlowId, sheetRowId]);

	const pageId = `secondary:${sheetRowId}`;
	const title = sheetRow?.config.view.content.title ?? "Sheet";
	const childRows = sheetRow?.config.view.content.children ?? [];

	const selectRow = useSelectRow(pageId, dispatchRow);

	const extraData = useMemo(() => ({ sheetRowId }), [sheetRowId]);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData,
	});

	const childRowIds = childRows.map((r) => r.id).join(",");
	// biome-ignore lint/correctness/useExhaustiveDependencies: childRowIds detects in-place array mutations that childRows reference misses
	const rowElements = useMemo(
		() => buildRowElements(childRows, selectRow),
		[childRows, childRowIds, selectRow],
	);

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--size-30px)" }}
		>
			<div
				className="evy-overflow-scroll evy-h-full evy-pt-4 evy-bg-white"
				style={rounded24Style}
				ref={scrollableRef}
			>
				<div style={baseTitleStyle}>{title}</div>
				{rowElements}
			</div>
		</div>
	);
}
