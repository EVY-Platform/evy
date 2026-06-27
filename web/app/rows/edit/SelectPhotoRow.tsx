import { MARKETPLACE_RESOURCE } from "evy-types/marketplaceResources";
import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SelectPhotoRow", {
	config: {
		type: "SelectPhoto",
		actions: [],
		source: "",
		visible: "true",
		title: "Select photo row title",
		subtitle: "Photos: 0/10",
		icon: "::image-plus::",
		content: "Add photos",
		photos: `{${MARKETPLACE_RESOURCE.ITEMS}.photo_ids}`,
		destination: `{${MARKETPLACE_RESOURCE.ITEMS}.photo_ids}`,
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.title}>
			<div
				className="evy-rounded-md evy-border evy-text-sm"
				style={{ padding: "var(--size-8)" }}
			>
				<div className="evy-flex evy-justify-center evy-text-center evy-flex-col">
					<EVYText text={row.config.icon} />
					<p className="evy-text-sm">
						<EVYText text={row.config.content} />
					</p>
				</div>
			</div>
			<p className="evy-text-sm">
				<EVYText text={row.config.subtitle} />
			</p>
		</RowLayout>
	),
});
