import { EVYRow, type Row, type RowConfig } from "../EVYRow";

export default class SelectPhotoRow extends EVYRow {
	static override config: RowConfig = {
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
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<div className="evy-rounded-md evy-px-8 evy-py-8 evy-border evy-text-sm">
					<div className="evy-flex evy-justify-center evy-text-center evy-flex-col">
						<img
							className="evy-h-4"
							src="/add_photo.svg"
							alt="Add photo"
						/>
						<p className="evy-text-sm">
							{row.config.view.content.content}
						</p>
					</div>
				</div>
				<p className="evy-text-sm">
					{row.config.view.content.subtitle}
				</p>
			</div>
		);
	}
}
