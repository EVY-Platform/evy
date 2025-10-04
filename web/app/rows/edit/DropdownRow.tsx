import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Dropdown from "../design-system/Dropdown";

export default class DropdownRow extends EVYRow {
	static override config: RowConfig = {
		type: "Dropdown",
		view: {
			content: {
				title: "Dropdown row title",
				placeholder: "Dropdown row placeholder",
				format: "{$0.value}",
			},
			data: "Dropdown row value",
		},
		edit: {
			destination: "{item.condition_id}",
			validation: {
				required: "true",
				message: "Please select an option",
			},
		},
	};

	renderContent() {
		return (
			<AppContext.Consumer>
				{({ flows, activeFlowId }) => {
					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row =
						pages
							.flatMap((page) => page.rowsData)
							.find((r) => r.rowId === this.props.rowId) ??
						DropdownRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<Dropdown
								value={row.config.view.data ?? ""}
								placeholder={
									row.config.view.content.placeholder
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
