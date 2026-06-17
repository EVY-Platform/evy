import type { RowConfig } from "../../types/row";
import EVYText from "../design-system/EVYText";
import { lineClampStyle } from "../design-system/lineClamp";
import { defineRow } from "../defineRow";

export default defineRow("ListItemRow", {
	config: {
		type: "ListItem",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "List item title",
				subtitle: "Subtitle",
				image: "",
			},
		},
	} satisfies RowConfig,
	render: (row) => {
		const { title = "", subtitle = "", image = "" } = row.config.view.content;

		return (
			<div className="evy-flex evy-flex-row evy-items-center evy-gap-2 evy-px-3 evy-py-2">
				<div
					className="evy-shrink-0 evy-bg-gray-light evy-rounded"
					style={{ width: 52, height: 52 }}
					title={image || "image placeholder"}
				/>
				<div className="evy-flex-1 evy-min-w-0">
					{title.trim() ? (
						<p className="evy-text-md" style={lineClampStyle(1)}>
							<EVYText text={title} />
						</p>
					) : null}
					{subtitle.trim() ? (
						<p className="evy-text-sm evy-text-gray" style={lineClampStyle(2)}>
							<EVYText text={subtitle} />
						</p>
					) : null}
				</div>
			</div>
		);
	},
});
