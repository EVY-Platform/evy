import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/DraggableRowContainer";
import { EVYRow } from "../EVYRow";
import Input from "@/app/rows/design-system/Input";

export default class InputRow extends EVYRow {
	static config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Input row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Input row placeholder",
		},
		{
			id: "value",
			type: "text",
			value: "Input row value",
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
									?.value ?? "Input row title"}
							</p>
							<Input
								value={
									row?.config.find((c) => c.id === "value")
										?.value ?? "Input row value"
								}
								placeholder={
									row?.config.find(
										(c) => c.id === "placeholder"
									)?.value ?? "Input row placeholder"
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
