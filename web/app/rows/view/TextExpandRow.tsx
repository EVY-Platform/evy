import { useLayoutEffect, useRef, useState } from "react";

import { useRowById } from "../../hooks/useRowById";
import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";
import { defineRow } from "../defineRow";

function maxLinesValue(maxLines: string | undefined): number {
	const parsedMaxLines = Number.parseInt(maxLines ?? "", 10);
	return Number.isFinite(parsedMaxLines) && parsedMaxLines > 0
		? parsedMaxLines
		: 3;
}

function TextExpandRowInner({ rowId }: { rowId: string }) {
	const row = useRowById(rowId);
	const textRef = useRef<HTMLParagraphElement | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [canExpand, setCanExpand] = useState(false);

	const title = row?.config.view.content.title ?? "";
	const text = row?.config.view.content.text ?? "";
	const expandLabel = row?.config.view.content.expandLabel ?? "";
	const maxLines = maxLinesValue(row?.config.view.max_lines);

	useLayoutEffect(() => {
		const textElement = textRef.current;
		if (!textElement || expanded) return;

		const updateCanExpand = () => {
			setCanExpand(textElement.scrollHeight > textElement.clientHeight + 1);
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
					style={expanded ? undefined : lineClampStyle(maxLines)}
				>
					<EVYText text={text} />
				</p>
			) : null}
			{canExpand && !expanded && expandLabel.trim() ? (
				<button
					type="button"
					className="evy-text-blue evy-text-sm evy-self-start evy-cursor-pointer"
					onClick={() => setExpanded(true)}
				>
					<EVYText text={expandLabel} />
				</button>
			) : null}
		</div>
	);
}

export default defineRow("TextExpandRow", {
	config: {
		type: "TextExpand",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Expandable text title",
				text: "This is a longer text row that can be expanded when it spans more lines than the configured maximum.",
				expandLabel: "Read more",
			},
			max_lines: "3",
		},
	} satisfies RowConfig,
	Component: TextExpandRowInner,
});
