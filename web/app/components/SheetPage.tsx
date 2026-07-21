import { type CSSProperties, type ReactNode, useCallback, useRef } from "react";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useParseText } from "../hooks/useParseText";
import { SheetRootRowIdContext, useRowById } from "../hooks/useRowById";
import { useDragContext } from "../state/contexts/DragContext";
import { useFlowsContext } from "../state/contexts/FlowsContext";
import { DraggableRowContainer } from "./DraggableRowContainer";
import { baseTitleStyle } from "./pageStyles";
import { SheetPageFrame } from "./SheetPageFrame";

const sheetTitleStyle: CSSProperties = {
	...baseTitleStyle,
	width: "100%",
	background: "none",
	border: "none",
};

export function SheetPage({
	sheetRowId,
	pageId,
	parentRowId,
}: {
	sheetRowId: string;
	pageId: string;
	parentRowId: string;
}) {
	const { dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const row = useRowById(sheetRowId);
	const parseText = useParseText();

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		extraData: {
			destinationContainerRowId: parentRowId,
			destinationContainerType: "sheet",
		},
	});

	const selectSheetRow = useCallback(() => {
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: sheetRowId });
	}, [dispatchRow, sheetRowId]);

	const sheetTitle = row?.config.title?.trim() ?? "";
	const heading = sheetTitle ? parseText(sheetTitle) : null;

	let titleElement: ReactNode = null;
	if (heading !== null) {
		titleElement = (
			<button
				type="button"
				className="evy-cursor-pointer"
				style={sheetTitleStyle}
				onClick={selectSheetRow}
			>
				{heading}
			</button>
		);
	}

	const content = (
		<>
			{titleElement}
			{row && (
				<DraggableRowContainer
					rowId={sheetRowId}
					selectRow={selectSheetRow}
					showIndicators
				>
					{row.row}
				</DraggableRowContainer>
			)}
		</>
	);

	return (
		<SheetPageFrame scrollableRef={scrollableRef}>
			<SheetRootRowIdContext.Provider value={sheetRowId}>
				{content}
			</SheetRootRowIdContext.Provider>
		</SheetPageFrame>
	);
}
