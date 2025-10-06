import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
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
						InputListRow;

					return (
						<div className="evy-p-2">
							<p className="evy-text-md">
								{row.config.view.content.title}
							</p>
							<Input
								value={row.config.view.data!}
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
