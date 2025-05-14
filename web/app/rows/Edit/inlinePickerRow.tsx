import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";

export default function InlinePickerRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);
	const sharedStyles = "rounded-md text-sm px-3 py-3";
	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Inline picker row title"}
			</p>
			<div className="p-2 flex gap-2">
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray-light text-black`}
				>
					1 min
				</button>
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray text-white`}
				>
					2 mins
				</button>
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray-light text-black`}
				>
					5 min
				</button>
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Inline picker row title",
	},
];
