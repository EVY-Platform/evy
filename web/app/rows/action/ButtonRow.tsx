import Button from "@/app/rows/design-system/Button";
import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/Row";
import { EVYRow } from "../EVYRow";

export default class ButtonRow extends EVYRow {
	static config: RowConfig = [
		{
			id: "text",
			type: "text",
			value: "Button row text",
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
						<div className="p-2 flex justify-center">
							<Button
								label={
									row?.config.find((c) => c.id === "text")
										?.value ?? "Button row text"
								}
							/>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
