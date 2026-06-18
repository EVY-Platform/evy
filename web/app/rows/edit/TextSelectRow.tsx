import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import Checkbox from "../design-system/Checkbox";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextSelectRow", {
	config: {
		type: "TextSelect",
		actions: [],
		source: "",
		visible: "true",
		view: {
			content: {
				title: "Text select row title",
				text: "placeholder",
			},
		},
		destination: "{dc28ed59-298e-493c-8ff3-3e60f2ebccbd.payment_cash}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-flex evy-justify-between evy-gap-2">
				<p className="evy-text-sm">
					<EVYText text={row.config.view.content.text} />
				</p>
				<Checkbox checked={false} />
			</div>
		</RowLayout>
	),
});
