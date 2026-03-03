import type { RowConfig } from "../../types/row";
import { defineRow } from "../defineRow";
import { RowLayout } from "../design-system/RowLayout";

export default defineRow("SelectPhotoRow", {
	config: {
		type: "SelectPhoto",
		view: {
			content: {
				title: "Select photo row title",
				subtitle: "Photos: 0/10",
				icon: "::photo.badge.plus.fill::",
				content: "Add photos",
				photos: "{item.photo_ids}",
			},
		},
		edit: {
			destination: "{item.photo_ids}",
			validation: {
				required: "true",
				message: "Photos of the item",
				minAmount: "3",
			},
		},
	} satisfies RowConfig,
	render: (row) => (
		<RowLayout title={row.config.view.content.title}>
			<div className="evy-rounded-md evy-px-8 evy-py-8 evy-border evy-text-sm">
				<div className="evy-flex evy-justify-center evy-text-center evy-flex-col">
					<img className="evy-h-4" src="/add_photo.svg" alt="Upload" />
					<p className="evy-text-sm">{row.config.view.content.content}</p>
				</div>
			</div>
			<p className="evy-text-sm">{row.config.view.content.subtitle}</p>
		</RowLayout>
	),
});
