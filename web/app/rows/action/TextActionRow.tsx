import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/DraggableRowContainer";
import { EVYRow } from "../EVYRow";

export default class TextActionRow extends EVYRow {
	static config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Text action row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Placeholder",
		},
		{
			id: "action",
			type: "text",
			value: "Action",
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
									?.value ?? "Text action row title"}
							</p>
							<div className="flex justify-between">
								<p className="text-evy-light">
									{row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Placeholder"}
								</p>
								<button className="text-evy-blue">
									{row?.config.find((c) => c.id === "action")
										?.value ?? "Action"}
								</button>
							</div>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
