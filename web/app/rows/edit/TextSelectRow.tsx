import type { RowConfig } from "../../types/row";
import { defaultRowActions, defineRow } from "../defineRow";
import Checkbox from "../design-system/Checkbox";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("TextSelectRow", {
	config: {
		type: "TextSelect",
		actions: defaultRowActions({
			tap: { fn: "select", value: "$datum" },
		}),
		source: "{resourceId.payment_cash}",
		visible: "true",
		title: "Text select row title",
		text: "placeholder",
		destination: "{resourceId.payment_cash}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div className="evy-flex evy-justify-between evy-gap-2">
				<p className="evy-text-sm">
					<EVYText text={row.config.text} />
				</p>
				<Checkbox checked={false} />
			</div>
		</RowLayout>
	),
});
