import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";

export default function SelectPhotoRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">Select photo row</p>
			<div className="rounded-md px-8 py-8 border border-evy-border border-opacity-50 text-sm">
				<div className="flex justify-center text-center flex-col">
					<img className="h-4" src="/add_photo.svg" alt="Add photo" />
					<p>
						{row?.config.find((c) => c.id === "content")?.value ??
							"Select photo row content"}
					</p>
				</div>
			</div>
			<p className="text-evy-light text-sm">
				{row?.config.find((c) => c.id === "subtitle")?.value ??
					"Select photo row subtitle"}
			</p>
		</div>
	);
}

export const config: RowConfig = [
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
