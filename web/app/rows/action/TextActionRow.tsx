import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextActionRow", {
	config: {
		type: "TextAction",
		actions: [],
		source: "{item}",
		view: {
			content: {
				title: "Text action row title",
				text: "Placeholder",
				placeholder: "Enter pick up address",
				action: "Change",
			},
		},
		destination: "{pickup_address}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-justify-between">
				<p className="evy-text-md">
					<EVYText text={row.config.view.content.text ?? ""} />
				</p>
				<button
					type="button"
					className="evy-text-blue evy-text-sm evy-hover:text-black evy-bg-transparent evy-border-none"
				>
					<EVYText text={row.config.view.content.action ?? ""} />
				</button>
			</div>
		</RowLayout>
	),
});
