import { useCallback, useMemo, useRef } from "react";

import { useDragContext, useFlowsContext } from "../state";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { buildRowElements } from "./buildRowElements";
import { baseTitleStyle, rounded24Style } from "./pageStyles";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";
import { findFlowById } from "../utils/flowHelpers";
import { findRowInPages } from "../utils/rowTree";

export default function SecondarySheetPage({
	sheetRowId,
}: {
	sheetRowId: string;
}) {
	const { flows, activeFlowId, dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const sheetRow = useMemo(() => {
		const pages = findFlowById(flows, activeFlowId)?.pages ?? [];
		return findRowInPages(sheetRowId, pages);
	}, [flows, activeFlowId, sheetRowId]);

	const pageId = `secondary:${sheetRowId}`;
	const title = sheetRow?.config.view.content.title ?? "Sheet";
	const childRows = sheetRow?.config.view.content.children ?? [];

	const selectRow = useCallback(
		(rowId: string) => dispatchRow({ type: "SET_ACTIVE_ROW", pageId, rowId }),
		[pageId, dispatchRow],
	);

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
				{...canvasPageInteriorDomProps}
				ref={scrollableRef}
			>
				<div style={baseTitleStyle}>{title}</div>
				{rowElements}
			</div>
		</div>
	);
}
