import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { TitleSubtitleRow } from "../design-system/TitleSubtitleRow";

export default defineRow("TextActionRow", {
	config: {
		type: "TextAction",
		actions: [],
		visible: "true",
		title: "Text action title",
		subtitle: "Subtitle",
		action: "Change",
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", subtitle = "", action = "" } = row.config;
		return (
			<TitleSubtitleRow
				title={title}
				subtitle={subtitle}
				trailing={
					action.trim() ? (
						<span className="evy-text-blue evy-text-sm evy-shrink-0">
							<EVYText text={action} />
						</span>
					) : null
				}
			/>
		);
	},
});
