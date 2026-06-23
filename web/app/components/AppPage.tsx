import { type CSSProperties, useCallback, useMemo, useRef } from "react";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { usePageEdgeIndicators } from "../hooks/usePageEdgeIndicators";
import { useParseText } from "../hooks/useParseText";
import { useDragContext, useFlowsContext } from "../state";
import { canvasPageInteriorDomProps } from "../utils/canvasPageInterior";
import { findFlowById } from "../utils/flowHelpers";
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
	const { flows, activeFlowId, dispatchRow } = useFlowsContext();
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

	const page = useMemo(
		() => findFlowById(flows, activeFlowId)?.pages.find((p) => p.id === pageId),
		[flows, activeFlowId, pageId],
	);

	const pageRows = page?.rows ?? [];
	const pageHasRows = pageRows.length > 0;
	const lastRowId = pageHasRows ? pageRows[pageRows.length - 1].id : undefined;

	const { forcedIndicators, showBlankPageIndicator, edgePosition } =
		usePageEdgeIndicators(pageId, lastRowId, pageHasRows);

	const rowElements = useMemo(() => {
		if (!page) return [];
		return buildRowElements(page.rows, selectRow, forcedIndicators);
	}, [page, selectRow, forcedIndicators]);

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

	const footer = page?.footer;

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full"
			style={{ padding: phoneContentPadding, contain: "layout style paint" }}
		>
			{footer ? (
				<div
					ref={pageWrapperRef}
					className="evy-overflow-hidden evy-flex evy-flex-col evy-h-full evy-bg-white"
					style={rounded24Style}
				>
					{titleElement}
					{showBlankPageIndicator && <BlankPageDropIndicator />}
					<div
						className="evy-overflow-scroll evy-flex evy-flex-col evy-flex-1"
						{...canvasPageInteriorDomProps}
						ref={scrollableRef}
					>
						{rowElements}
						<PageEdgeDropZone
							pageId={pageId}
							position={edgePosition}
							dispatchDropIndicator={dispatchDropIndicator}
							className="evy-flex-1"
							style={{ minHeight: "var(--size-8)" }}
							onClick={selectPageDirect}
						/>
					</div>
					<DraggableRowContainer
						rowId={footer.id}
						selectRow={() => selectRow(footer.id)}
					>
						{footer.row}
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
						{showBlankPageIndicator && <BlankPageDropIndicator />}
						{rowElements}
						<PageEdgeDropZone
							pageId={pageId}
							position={edgePosition}
							dispatchDropIndicator={dispatchDropIndicator}
							className="evy-flex-1"
							style={{ minHeight: "var(--size-8)" }}
							onClick={selectPageDirect}
						/>
						{dragging && <FooterPlaceholderDropIndicator pageId={pageId} />}
					</div>
				</div>
			)}
		</div>
	);
}
