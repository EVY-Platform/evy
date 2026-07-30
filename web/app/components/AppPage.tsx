import { type CSSProperties, useCallback, useMemo, useRef } from "react";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { usePageEdgeIndicators } from "../hooks/usePageEdgeIndicators";
import { useParseText } from "../hooks/useParseText";
import { storedRowToRow } from "../rows/rowElementFactory";
import { useDragContext } from "../state/contexts/DragContext";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";
import { capturePageFramePosition } from "../utils/preActivationCapture";
import { BlankPageDropIndicator } from "./BlankPageDropIndicator";
import { buildRowElements } from "./buildRowElements";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { FooterPlaceholderDropIndicator } from "./FooterPlaceholderDropIndicator";
import { PageEdgeDropZone } from "./PageEdgeDropZone";

import {
	baseTitleStyle,
	phoneContentPadding,
	rounded24Style,
} from "./pageStyles";

const pageTitleStyle: CSSProperties = {
	...baseTitleStyle,
	width: "100%",
	background: "none",
	border: "none",
};

export default function AppPage({ pageId }: { pageId: string }) {
	const { pagesById, rowsById, rows, dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator, dragging } = useDragContext();
	const parseText = useParseText();

	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const pageWrapperRef = useRef<HTMLDivElement | null>(null);

	const selectRow = useCallback(
		(rowId: string) => {
			capturePageFramePosition(pageId);
			dispatchRow({ type: "SET_ACTIVE_ROW", rowId });
		},
		[pageId, dispatchRow],
	);

	const selectPage = useCallback(
		(e: MouseEvent) => {
			if (e.target === e.currentTarget) {
				capturePageFramePosition(pageId);
				dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
			}
		},
		[pageId, dispatchRow],
	);

	const selectPageDirect = useCallback(() => {
		capturePageFramePosition(pageId);
		dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
	}, [pageId, dispatchRow]);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		onClickBackground: selectPage,
		dropTargetRef: pageWrapperRef,
	});

	const page = pagesById[pageId];
	const pageRowIds = page?.row_ids ?? [];
	const pageHasRows = pageRowIds.length > 0;
	const lastRowId = pageHasRows
		? pageRowIds[pageRowIds.length - 1]
		: undefined;

	const { forcedIndicators, showBlankPageIndicator, edgePosition } =
		usePageEdgeIndicators(pageId, lastRowId, pageHasRows);

	const rowElements = useMemo(() => {
		if (!page) return [];
		return buildRowElements(
			page.row_ids,
			rowsById,
			rows,
			selectRow,
			forcedIndicators,
		);
	}, [page, rowsById, rows, selectRow, forcedIndicators]);

	const titleElement = page?.title ? (
		<button
			type="button"
			className="evy-cursor-pointer"
			style={pageTitleStyle}
			onClick={selectPageDirect}
		>
			{parseText(page.title)}
		</button>
	) : null;

	const footer_row_id = page?.footer_row_id;
	const footerRecord = footer_row_id ? rowsById[footer_row_id] : undefined;
	const footerRowElement = footerRecord
		? storedRowToRow(footerRecord).row
		: undefined;

	const blankPageIndicator = showBlankPageIndicator ? (
		<BlankPageDropIndicator />
	) : null;
	const edgeDropZone = (
		<PageEdgeDropZone
			pageId={pageId}
			position={edgePosition}
			dispatchDropIndicator={dispatchDropIndicator}
			className="evy-flex-1"
			style={{ minHeight: "var(--size-8)" }}
			onClick={selectPageDirect}
		/>
	);
	const scrollBody = (
		<>
			{rowElements}
			{edgeDropZone}
		</>
	);

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full"
			style={{
				padding: phoneContentPadding,
				contain: "layout style paint",
			}}
		>
			{footer_row_id ? (
				<div
					ref={pageWrapperRef}
					className="evy-overflow-hidden evy-flex evy-flex-col evy-h-full evy-bg-white"
					style={rounded24Style}
				>
					{titleElement}
					{blankPageIndicator}
					<div
						className="evy-overflow-scroll evy-flex evy-flex-col evy-flex-1"
						{...canvasPageInteriorDomProps}
						ref={scrollableRef}
					>
						{scrollBody}
					</div>
					<DraggableRowContainer
						rowId={footer_row_id}
						selectRow={() => selectRow(footer_row_id)}
					>
						{footerRowElement}
					</DraggableRowContainer>
				</div>
			) : (
				<div
					className="evy-overflow-hidden evy-flex evy-flex-col evy-h-full evy-bg-white"
					style={rounded24Style}
				>
					<div
						className="evy-overflow-scroll evy-flex evy-flex-col evy-h-full"
						{...canvasPageInteriorDomProps}
						ref={scrollableRef}
					>
						{titleElement}
						{blankPageIndicator}
						{scrollBody}
						{dragging && (
							<FooterPlaceholderDropIndicator pageId={pageId} />
						)}
					</div>
				</div>
			)}
		</div>
	);
}
