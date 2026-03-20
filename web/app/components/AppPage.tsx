import type { CSSProperties } from "react";
import { useCallback, useContext, useMemo, useRef } from "react";

import { AppContext } from "../state";
import { usePageDropTarget } from "../hooks/usePageDropTarget";
import { useSelectRow } from "../hooks/useSelectRow";
import { buildRowElements } from "./buildRowElements";
import { baseTitleStyle, rounded24Style } from "./pageStyles";

const pageTitleStyle: CSSProperties = {
	...baseTitleStyle,
	width: "100%",
	background: "none",
	border: "none",
};

const roundedBottom24Style: CSSProperties = {
	borderBottomLeftRadius: "var(--radius-2-4)",
	borderBottomRightRadius: "var(--radius-2-4)",
};

export default function AppPage({ pageId }: { pageId: string }) {
	const { flows, activeFlowId, dispatchRow, dispatchDropIndicator } =
		useContext(AppContext);

	const scrollableRef = useRef<HTMLDivElement | null>(null);

	const selectRow = useSelectRow(pageId, dispatchRow);

	const selectPage = useCallback(
		(e: MouseEvent) => {
			if (e.target === e.currentTarget) {
				dispatchRow({ type: "SET_ACTIVE_PAGE", pageId });
			}
		},
		[pageId, dispatchRow],
	);

	usePageDropTarget({
		scrollableRef,
		pageId,
		dispatchDropIndicator,
		onClickBackground: selectPage,
	});

	const page = useMemo(
		() =>
			flows
				.find((f) => f.id === activeFlowId)
				?.pages.find((p) => p.id === pageId),
		[flows, activeFlowId, pageId],
	);

	const rowElements = useMemo(() => {
		if (!page) return [];
		return buildRowElements(page.rows, selectRow);
	}, [page, selectRow]);

	const titleElement = page?.title ? (
		<button
			type="button"
			className="evy-cursor-pointer"
			style={pageTitleStyle}
			onClick={() => dispatchRow({ type: "SET_ACTIVE_PAGE", pageId })}
		>
			{page.title}
		</button>
	) : null;

	const footer = page?.footer;

	return (
		<div
			className="evy-overflow-hidden evy-h-full evy-w-full evy-box-sizing-border"
			style={{ padding: "var(--size-30px)" }}
		>
			{footer ? (
				<div
					className="evy-flex evy-flex-col evy-h-full evy-bg-white"
					style={rounded24Style}
				>
					{titleElement}
					<div
						className="evy-overflow-scroll evy-flex-1 evy-pt-4"
						ref={scrollableRef}
					>
						{rowElements}
					</div>
					<button
						type="button"
						className="evy-border-none evy-hover:bg-gray-light evy-cursor-pointer evy-w-full evy-bg-white evy-p-0"
						style={roundedBottom24Style}
						onClick={() => selectRow(footer.id)}
					>
						{footer.row}
					</button>
				</div>
			) : (
				<div
					className="evy-overflow-scroll evy-h-full evy-pt-4 evy-bg-white"
					style={rounded24Style}
					ref={scrollableRef}
				>
					{titleElement}
					{rowElements}
				</div>
			)}
		</div>
	);
}
