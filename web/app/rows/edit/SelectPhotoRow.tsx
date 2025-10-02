import { AppContext } from "../../registry";
import { EVYRow, RowConfig } from "../EVYRow";

export default class SelectPhotoRow extends EVYRow {
	static override config: RowConfig = [
		{
			id: "content",
			type: "text",
			value: "Select photo row content",
		},
		{
			id: "subtitle",
			type: "text",
			value: "Select photo row subtitle",
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
						<div className="evy-p-2">
							<p className="evy-pb-2">Select photo row</p>
							<div className="evy-rounded-md evy-px-8 evy-py-8 evy-border evy-text-sm">
								<div className="evy-flex evy-justify-center evy-text-center evy-flex-col">
									<img
										className="evy-h-4"
										src="/add_photo.svg"
										alt="Add photo"
									/>
									<p>
										{row?.config.find(
											(c) => c.id === "content"
										)?.value ?? "Select photo row content"}
									</p>
								</div>
							</div>
							<p className="evy-text-sm">
								{row?.config.find((c) => c.id === "subtitle")
									?.value ?? "Select photo row subtitle"}
							</p>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
