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

export default defineRow("InfoRow", {
	config: {
		type: "Info",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Info row title",
				subtitle: "",
				icon: "",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const { title, subtitle, icon } = row.config.view.content;
		const titleStr = title ?? "";
		const subtitleStr = subtitle ?? "";
		const iconStr = (icon ?? "").trim();

		const hasTitle = titleStr.length > 0;
		const body = (
			<div
				className={
					hasTitle ? "evy-min-w-0 evy-flex-1" : "evy-flex-1 evy-text-center"
				}
			>
				{hasTitle ? (
					<p className="evy-text-md" style={lineClampStyle(1)}>
						<EVYText text={titleStr} />
					</p>
				) : null}
				{subtitleStr.length > 0 ? (
					<p className="evy-text-sm evy-text-gray" style={lineClampStyle(3)}>
						<EVYText text={subtitleStr} />
					</p>
				) : null}
			</div>
		);

		return (
			<div className="evy-p-2">
				{iconStr.length > 0 ? (
					<div className="evy-flex evy-items-start evy-gap-2">
						<div className="evy-shrink-0 evy-flex evy-items-center evy-justify-center evy-min-w-[2rem] evy-text-md">
							<EVYText text={iconStr} />
						</div>
						{body}
					</div>
				) : (
					<div
						className={
							hasTitle
								? "evy-flex evy-items-start"
								: "evy-flex evy-justify-center"
						}
					>
						{body}
					</div>
				)}
			</div>
		);
	},
});
