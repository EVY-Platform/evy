import type { Row, RowConfig } from "../../types/row";
import { EVYRow } from "../EVYRow";
import Input from "../design-system/Input";

export default class InputRow extends EVYRow {
	static override config: RowConfig = {
		type: "Input",
		view: {
			content: {
				title: "Input row title",
				placeholder: "placeholder",
				value: "",
			},
		},
		edit: {
			destination: "{item.title}",
			validation: {
				required: "true",
				message: "This field is required",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p className="evy-text-md">{row.config.view.content.title}</p>
				<Input
					value={row.config.view.content.value?.toString() ?? ""}
					placeholder={row.config.view.content.placeholder?.toString() ?? ""}
				/>
			</div>
		);
	}
}
