import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import { RowConfig } from "../../row.tsx";

export default function ButtonRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2 flex justify-center">
			<button
				type="button"
				className="rounded-sm text-sm px-3 py-3 text-white bg-evy-gray hover:bg-black"
			>
				{row?.config.find((c) => c.id === "text")?.value ??
					"Button row text"}
			</button>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "text",
		type: "text",
		value: "Button row text",
	},
];
