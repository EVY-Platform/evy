import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/DraggableRowContainer";
import { EVYRow } from "../EVYRow";

export default class TextRow extends EVYRow {
	static config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Text row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Text row placeholder",
		},
	];

	renderContent() {
		const rowId = this.props.rowId;

		return (
			<AppContext.Consumer>
				{({ pages }) => {
					const row = pages
						.flatMap((page) => page.rowsData)
						.find((r) => r.rowId === rowId);

					return (
						<div className="p-2">
							<p className="pb-2">
								{row?.config.find((c) => c.id === "title")
									?.value ?? "Text row title"}
							</p>
							<p>
								{row?.config.find((c) => c.id === "placeholder")
									?.value ?? "Text row placeholder"}
							</p>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
