import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useParseText } from "../hooks/useParseText";
import { SheetRootRowIdContext, useRowById } from "../hooks/useRowById";
import { useDragContext, useFlowsContext } from "../state";
import { ChildPageFrame } from "./ChildPageFrame";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { baseTitleStyle } from "./pageStyles";

const sheetTitleStyle: CSSProperties = {
	...baseTitleStyle,
	width: "100%",
	background: "none",
	border: "none",
};

export function ChildPage({
	childRowId,
	pageId,
	parentRowId,
	variant,
}: {
	childRowId: string;
	pageId: string;
	parentRowId: string;
	variant: "full" | "sheet";
}) {
	const { dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const row = useRowById(childRowId);
	const parseText = useParseText();

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: { destinationContainerRowId: parentRowId },
	});

	const selectChild = useCallback(() => {
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: childRowId });
	}, [dispatchRow, childRowId]);

	const childTitle = row?.config.title?.trim() ?? "";
	const heading =
		variant === "full"
			? "Search result"
			: childTitle
				? parseText(childTitle)
				: null;

	let titleElement: ReactNode = null;
	if (heading !== null) {
		titleElement =
			variant === "sheet" ? (
				<button
					type="button"
					className="evy-cursor-pointer"
					style={sheetTitleStyle}
					onClick={selectChild}
				>
					{heading}
				</button>
			) : (
				<h2 style={baseTitleStyle}>{heading}</h2>
			);
	}

	const content = (
		<>
			{titleElement}
			{row && (
				<DraggableRowContainer
					rowId={childRowId}
					selectRow={selectChild}
					showIndicators
				>
					{row.row}
				</DraggableRowContainer>
			)}
		</>
	);

	return (
		<ChildPageFrame scrollableRef={scrollableRef} variant={variant}>
			{variant === "sheet" ? (
				<SheetRootRowIdContext.Provider value={childRowId}>
					{content}
				</SheetRootRowIdContext.Provider>
			) : (
				content
			)}
		</ChildPageFrame>
	);
}
