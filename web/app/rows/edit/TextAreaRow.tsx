import { EVYRow, Row, RowConfig } from "../EVYRow";
import TextArea from "../design-system/TextArea";

export default class TextAreaRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextArea",
		view: {
			content: {
				title: "Text area row title",
				value: "",
				placeholder: "placeholder",
			},
		},
		edit: {
			destination: "{item.description}",
			validation: {
				required: "true",
				message: "Please provide a description",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<TextArea
					value={row.config.view.content.value}
					placeholder={row.config.view.content.placeholder}
				/>
			</div>
		);
	}
}
