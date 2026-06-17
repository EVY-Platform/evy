import type { CSSProperties } from "react";

import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { defineRow } from "../defineRow";

function lineClampStyle(lines: number): CSSProperties {
	return {
		display: "-webkit-box",
		WebkitLineClamp: lines,
		WebkitBoxOrient: "vertical",
		overflow: "hidden",
		overflowWrap: "anywhere",
		wordBreak: "break-word",
	};
}

function maxLinesValue(maxLines: string | undefined): number {
	const parsedMaxLines = Number.parseInt(maxLines ?? "", 10);
	return Number.isFinite(parsedMaxLines) && parsedMaxLines > 0
		? parsedMaxLines
		: 1;
}

export default defineRow("TextRow", {
	config: {
		type: "Text",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Text row title",
				subtitle: "Subtitle",
				icon: "::star::",
				text: "",
				action: "Edit button",
			},
			max_lines: "",
		},
	} satisfies RowConfig,
	render: (row) => {
		const {
			title = "",
			subtitle = "",
			icon = "",
			text = "",
			placeholder = "",
			action = "",
		} = row.config.view.content;

		const textStyle = lineClampStyle(maxLinesValue(row.config.view.max_lines));

		return (
			<div className="evy-flex evy-flex-col evy-gap-1 evy-px-3 evy-py-2">
				<div className="evy-flex evy-flex-row evy-items-center evy-gap-2">
					{icon.trim() ? (
						<span className="evy-shrink-0">
							<EVYText text={icon} />
						</span>
					) : null}
					<div className="evy-flex-1 evy-min-w-0">
						{title.trim() ? (
							<p className="evy-text-md" style={lineClampStyle(1)}>
								<EVYText text={title} />
							</p>
						) : null}
						{subtitle.trim() ? (
							<p
								className="evy-text-sm evy-text-gray"
								style={lineClampStyle(3)}
							>
								<EVYText text={subtitle} />
							</p>
						) : null}
					</div>
					{action.trim() ? (
						<span className="evy-text-blue evy-text-sm evy-shrink-0">
							<EVYText text={action} />
						</span>
					) : null}
				</div>
				{text.trim() ? (
					<p className="evy-text-sm" style={textStyle}>
						<EVYText text={text || placeholder} />
					</p>
				) : null}
			</div>
		);
	},
});
