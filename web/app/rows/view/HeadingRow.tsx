import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";
import { defineRow } from "../defineRow";

export default defineRow("HeadingRow", {
	config: {
		type: "Heading",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Heading row title",
				label: "Label",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", label = "" } = row.config.view.content;

		return (
			<div className="evy-flex evy-flex-row evy-items-center evy-gap-2 evy-p-2">
				<div className="evy-flex-1 evy-min-w-0">
					{title.trim() ? (
						<p
							className="evy-text-md evy-font-semibold"
							style={lineClampStyle(1)}
						>
							<EVYText text={title} />
						</p>
					) : null}
				</div>
				{label.trim() ? (
					<span className="evy-text-sm evy-text-gray evy-shrink-0">
						<EVYText text={label} />
					</span>
				) : null}
			</div>
		);
	},
});
