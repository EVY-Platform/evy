import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";
import { TitleSubtitleRow } from "../design-system/TitleSubtitleRow";

export default defineRow("TextRow", {
	config: {
		type: "text",
		actions: {},
		visible: "true",
		title: "Text row title",
		subtitle: "Subtitle",
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", subtitle = "", label = "" } = row.config;
		return (
			<TitleSubtitleRow
				title={title}
				subtitle={subtitle}
				centerSubtitleWhenTitleEmpty
				trailing={
					label.trim() ? (
						<p
							className="evy-text-sm evy-text-gray"
							style={lineClampStyle(1)}
						>
							<EVYText text={label} />
						</p>
					) : null
				}
			/>
		);
	},
});
