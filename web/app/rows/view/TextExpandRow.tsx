import { useLayoutEffect, useRef, useState } from "react";

import { useRowById } from "../../hooks/useRowById";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";

const TEXT_EXPAND_COLLAPSED_LINE_COUNT = 3;

function TextExpandRowInner({ rowId }: { rowId: string }) {
	const row = useRowById(rowId);
	const textRef = useRef<HTMLParagraphElement | null>(null);
	const title = row?.config.title ?? "";
	const text = row?.config.text ?? "";
	const expand_label = row?.config.expand_label ?? "";
	const isCollapsible = expand_label.trim().length > 0;
	const [userExpanded, setUserExpanded] = useState(false);
	const [canExpand, setCanExpand] = useState(false);
	const expanded = !isCollapsible || userExpanded;

	useLayoutEffect(() => {
		const textElement = textRef.current;
		if (!textElement || expanded) return;

		const updateCanExpand = () => {
			setCanExpand(
				textElement.scrollHeight > textElement.clientHeight + 1,
			);
		};

		updateCanExpand();
		const resizeObserver = new ResizeObserver(updateCanExpand);
		resizeObserver.observe(textElement);

		return () => resizeObserver.disconnect();
	}, [expanded]);

	if (!row) return null;

	return (
		<div className="evy-flex evy-flex-col evy-gap-1 evy-p-2">
			{title.trim() ? (
				<p className="evy-text-md" style={lineClampStyle(1)}>
					<EVYText text={title} />
				</p>
			) : null}
			{text.trim() ? (
				<p
					ref={textRef}
					className="evy-text-sm"
					style={
						expanded
							? undefined
							: lineClampStyle(TEXT_EXPAND_COLLAPSED_LINE_COUNT)
					}
				>
					<EVYText text={text} />
				</p>
			) : null}
			{canExpand && !expanded ? (
				<button
					type="button"
					className="evy-text-blue evy-text-sm evy-self-start evy-cursor-pointer"
					onClick={() => setUserExpanded(true)}
				>
					<EVYText text={expand_label} />
				</button>
			) : null}
		</div>
	);
}

export default defineRow("TextExpandRow", {
	config: {
		type: "text_expand",
		actions: {},
		visible: "true",
		title: "Expandable text title",
		text: "This is a longer text row that can be expanded when it spans more lines than the configured maximum.",
		expand_label: "Read more",
	} satisfies RowConfig,
	Component: TextExpandRowInner,
});
