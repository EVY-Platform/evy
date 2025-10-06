import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";
import Input from "../design-system/Input";
import InlineIcon from "../design-system/InlineIcon";

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
						SearchRow;

					return (
						<div className="evy-p-2">
							<p className="evy-text-md">
								{row.config.view.content.title}
							</p>
							<div className="evy-relative">
								<InlineIcon icon="/search.svg" alt="Search" />
								<Input
									value={row.config.view.data!}
									placeholder={
										row.config.view.content.placeholder
									}
									offset="left"
								/>
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
