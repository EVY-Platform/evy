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
				subtitle: "",
				icon: "",
				text: "",
				action: "",
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
		const iconStr = icon.trim();
		const actionStr = action.trim();
		const hasAction = actionStr.length > 0;
		const hasSubtitle = subtitle.length > 0;
		const showIcon = iconStr.length > 0;
		const hasTextSection =
			text.trim().length > 0 || placeholder.trim().length > 0 || hasAction;

		const textStyle = lineClampStyle(maxLinesValue(row.config.view.max_lines));

		return (
			<div className="evy-p-2">
				{showIcon || hasSubtitle || title ? (
					<div
						className={
							showIcon
								? "evy-flex evy-items-start evy-gap-2"
								: title
									? "evy-flex evy-items-start"
									: "evy-flex evy-justify-center"
						}
					>
						{showIcon ? (
							<div className="evy-shrink-0 evy-flex evy-items-center evy-justify-center evy-min-w-[2rem] evy-text-md">
								<EVYText text={iconStr} />
							</div>
						) : null}
						<div
							className={
								title ? "evy-min-w-0 evy-flex-1" : "evy-flex-1 evy-text-center"
							}
						>
							{title ? (
								<p className="evy-text-md" style={lineClampStyle(1)}>
									<EVYText text={title} />
								</p>
							) : null}
							{hasSubtitle ? (
								<p
									className="evy-text-sm evy-text-gray"
									style={lineClampStyle(3)}
								>
									<EVYText text={subtitle} />
								</p>
							) : null}
						</div>
					</div>
				) : null}

				{hasTextSection ? (
					hasAction ? (
						<div className="evy-flex evy-justify-between evy-gap-2">
							<p className="evy-text-sm evy-min-w-0">
								<EVYText text={text || placeholder} />
							</p>
							<button
								type="button"
								className="evy-text-blue evy-text-sm evy-hover:text-black evy-bg-transparent evy-border-none evy-p-0 evy-shrink-0"
							>
								<EVYText text={actionStr} />
							</button>
						</div>
					) : (
						<p className="evy-text-sm" style={textStyle}>
							<EVYText text={text} />
						</p>
					)
				) : null}
			</div>
		);
	},
});
