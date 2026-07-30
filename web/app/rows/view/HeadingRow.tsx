import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { TitleSubtitleRow } from "../design-system/TitleSubtitleRow";

export default defineRow("HeadingRow", {
	config: {
		type: "heading",
		actions: {},
		visible: "true",
		title: "Heading row title",
		label: "Label",
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", label = "" } = row.config;

		return (
			<TitleSubtitleRow
				title={title}
				titleBold
				trailing={
					label.trim() ? (
						<span className="evy-text-sm evy-text-gray evy-shrink-0">
							<EVYText text={label} />
						</span>
					) : null
				}
			/>
		);
	},
});
