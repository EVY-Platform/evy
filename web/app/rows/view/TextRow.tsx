import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";

export default defineRow("TextRow", {
	config: {
		type: "Text",
		actions: [],
		visible: "true",
		title: "Text row title",
		subtitle: "Subtitle",
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", subtitle = "" } = row.config;

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
			</div>
		);
	},
});
