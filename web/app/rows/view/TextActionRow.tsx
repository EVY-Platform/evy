import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";

export default defineRow("TextActionRow", {
	config: {
		type: "TextAction",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Text action title",
				subtitle: "Subtitle",
				action: "Change",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const {
			title = "",
			subtitle = "",
			action = "",
		} = row.config.view.content;

		return (
			<div className="evy-flex evy-flex-row evy-items-center evy-gap-2 evy-p-2">
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
		);
	},
});
