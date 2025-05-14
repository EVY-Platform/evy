import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";

export default function TextSelectRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Text select row title"}
			</p>
			<div className="flex justify-between">
				<p className="text-evy-light">
					{row?.config.find((c) => c.id === "placeholder")?.value ??
						"Text select row placeholder"}
				</p>
				<input
					id="checkbox"
					type="checkbox"
					value=""
					className="w-4 h-4 bg-evy-gray border-evy-gray rounded"
				/>
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Text select row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Text select row placeholder",
	},
];
