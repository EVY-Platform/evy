import type { Row, RowConfig } from "../../types/row";
import { EVYRow } from "../EVYRow";
import Dropdown from "../design-system/Dropdown";

export default class DropdownRow extends EVYRow {
	static override config: RowConfig = {
		type: "Dropdown",
		view: {
			content: {
				title: "Dropdown row title",
				placeholder: "placeholder",
				format: "{$0.value}",
			},
			data: "",
		},
		edit: {
			destination: "{item.condition_id}",
			validation: {
				required: "true",
				message: "Please select an option",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<Dropdown
					value={row.config.view.data ?? ""}
					placeholder={row.config.view.content.placeholder ?? ""}
				/>
			</div>
		);
	}
}
