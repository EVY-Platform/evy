import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextRow", {
	config: {
		type: "Text",
		actions: [],
		source: "",
		view: {
			content: {
				title: "Text row title",
				text: "placeholder",
				placeholder: "",
				action: "",
			},
			max_lines: "",
		},
	} satisfies RowConfig,
	render: (row) => {
		const action = row.config.view.content.action;
		const hasAction = typeof action === "string" && action.trim().length > 0;
		const text = row.config.view.content.text;
		const placeholder = row.config.view.content.placeholder;
		const displayText = text || placeholder;

		return (
			<RowLayout title={row.config.view.content.title}>
				{hasAction ? (
					<div className="evy-flex evy-justify-between evy-gap-2">
						<p className="evy-text-sm evy-min-w-0">
							<EVYText text={displayText} />
						</p>
						<button
							type="button"
							className="evy-text-blue evy-text-sm evy-hover:text-black evy-bg-transparent evy-border-none evy-p-0 evy-shrink-0"
						>
							<EVYText text={action} />
						</button>
					</div>
				) : (
					<p className="evy-text-sm">
						<EVYText text={text} />
					</p>
				)}
			</RowLayout>
		);
	},
});
