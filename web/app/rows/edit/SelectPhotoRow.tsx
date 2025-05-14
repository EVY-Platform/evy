import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/DraggableRowContainer";
import { EVYRow } from "../EVYRow";

export default class SelectPhotoRow extends EVYRow {
	static config: RowConfig = [
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
						<div className="p-2">
							<p className="pb-2">Select photo row</p>
							<div className="rounded-md px-8 py-8 border border-evy-border border-opacity-50 text-sm">
								<div className="flex justify-center text-center flex-col">
									<img
										className="h-4"
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
							<p className="text-evy-light text-sm">
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
