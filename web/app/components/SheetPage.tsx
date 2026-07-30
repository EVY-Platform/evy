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
	sheet_row_id,
	pageId,
	parentRowId,
}: {
	sheet_row_id: string;
	pageId: string;
	parentRowId: string;
}) {
	const { dispatchRow } = useFlowsContext();
	const { dispatchDropIndicator } = useDragContext();
	const scrollableRef = useRef<HTMLDivElement | null>(null);
	const row = useRowById(sheet_row_id);
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
		dispatchRow({ type: "SET_ACTIVE_ROW", rowId: sheet_row_id });
	}, [dispatchRow, sheet_row_id]);

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
					rowId={sheet_row_id}
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
			<SheetRootRowIdContext.Provider value={sheet_row_id}>
				{content}
			</SheetRootRowIdContext.Provider>
		</SheetPageFrame>
	);
}
