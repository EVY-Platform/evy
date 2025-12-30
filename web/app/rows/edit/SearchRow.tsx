import { EVYRow, type Row, type RowConfig } from "../EVYRow";
import InlineIcon from "../design-system/InlineIcon";
import Input from "../design-system/Input";

export default class SearchRow extends EVYRow {
	static override config: RowConfig = {
		type: "Search",
		view: {
			content: {
				title: "Search row title",
				format: "{$0.value}",
				placeholder: "placeholder",
			},
			data: "",
		},
		edit: {
			destination: "{item.address}",
			validation: {
				required: "false",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<div className="evy-relative">
					<InlineIcon icon="/search.svg" alt="Search" />
					<Input
						value={row.config.view.data ?? ""}
						placeholder={row.config.view.content.placeholder}
						offset="left"
					/>
				</div>
			</div>
		);
	}
}
