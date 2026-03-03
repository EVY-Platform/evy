import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextActionRow", {
	config: {
		type: "TextAction",
		view: {
			content: {
				title: "Text action row title",
				text: "Placeholder",
				placeholder: "Enter pick up address",
				action: "Change",
			},
		},
		edit: {
			destination: "{item.transfer_options.pickup.address}",
			validation: {
				required: "true",
				message: "Please provide an address",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-justify-between">
				<p className="evy-text-md">{row.config.view.content.text}</p>
				<button
					type="button"
					className="evy-text-blue evy-text-sm evy-hover:text-black evy-bg-transparent evy-border-none"
				>
					{row.config.view.content.action}
				</button>
			</div>
		</RowLayout>
	),
});
