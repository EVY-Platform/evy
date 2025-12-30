import { EVYRow, type Row, type RowConfig } from "../EVYRow";
import Input from "../design-system/Input";

export default class InputListRow extends EVYRow {
	static override config: RowConfig = {
		type: "InputList",
		view: {
			content: {
				title: "Input list row title",
				placeholder: "Search for tags",
				format: "{$0.value}",
			},
			data: "",
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<Input
					value={row.config.view.data ?? ""}
					placeholder={row.config.view.content.placeholder}
				/>
			</div>
		);
	}
}
