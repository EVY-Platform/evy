import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import TextArea from "../design-system/TextArea";

export default class TextAreaRow extends EVYRow {
	static override config: RowConfig = {
		type: "TextArea",
		view: {
			content: {
				title: "",
				value: "Text area row value",
				placeholder: "Text area row placeholder",
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
						TextAreaRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
							<TextArea
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
