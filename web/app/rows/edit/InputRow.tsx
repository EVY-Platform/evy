import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
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

	renderContent() {
		return (
			<AppContext.Consumer>
				{({ flows, activeFlowId }) => {
					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row =
						pages
							.flatMap((page) => page.rows)
							.find((r) => r.rowId === this.props.rowId) ??
						InputRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<Input
								value={row.config.view.content.value}
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
