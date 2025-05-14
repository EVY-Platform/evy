import { AppContext } from "@/app/registry.tsx";
import { EVYRow, RowConfig } from "../EVYRow";
import Input from "@/app/rows/design-system/Input";
import InlineIcon from "@/app/rows/design-system/InlineIcon";

export default class SearchRow extends EVYRow {
	static config: RowConfig = [
		{
			id: "title",
			type: "text",
			value: "Search row title",
		},
		{
			id: "placeholder",
			type: "text",
			value: "Search row placeholder",
		},
		{
			id: "value",
			type: "text",
			value: "Search row value",
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
									?.value ?? "Search row title"}
							</p>
							<div className="relative">
								<InlineIcon icon="/search.svg" alt="Search" />
								<Input
									value={
										row?.config.find(
											(c) => c.id === "value"
										)?.value ?? "Search row value"
									}
									placeholder={
										row?.config.find(
											(c) => c.id === "placeholder"
										)?.value ?? "Search row placeholder"
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
