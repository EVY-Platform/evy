import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import EVYText from "../design-system/EVYText";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SelectPhotoRow", {
	config: {
		type: "SelectPhoto",
		actions: [],
		source: "{item}",
		view: {
			content: {
				title: "Select photo row title",
				subtitle: "Photos: 0/10",
				icon: "::image-plus::",
				content: "Add photos",
				photos: "{item.photo_ids}",
			},
		},
		destination: "{photo_ids}",
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div
				className="evy-rounded-md evy-border evy-text-sm"
				style={{ padding: "var(--size-8)" }}
			>
				<div className="evy-flex evy-justify-center evy-text-center evy-flex-col">
					<EVYText
						text={
							typeof row.config.view.content.icon === "string"
								? row.config.view.content.icon
								: ""
						}
					/>
					<p className="evy-text-sm">
						<EVYText
							text={
								typeof row.config.view.content.content === "string"
									? row.config.view.content.content
									: ""
							}
						/>
					</p>
				</div>
			</div>
			<p className="evy-text-sm">
				<EVYText
					text={
						typeof row.config.view.content.subtitle === "string"
							? row.config.view.content.subtitle
							: ""
					}
				/>
			</p>
		</RowLayout>
	),
});
