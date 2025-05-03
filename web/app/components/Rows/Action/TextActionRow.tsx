import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import { RowConfig } from "../../row.tsx";

export default function TextActionRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Text action row title"}
			</p>
			<div className="flex justify-between">
				<p className="text-evy-light">
					{row?.config.find((c) => c.id === "placeholder")?.value ??
						"Text action row placeholder"}
				</p>
				<button type="button" className="text-evy-blue">
					{row?.config.find((c) => c.id === "action")?.value ??
						"Text action row action"}
				</button>
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Text action row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Text action row placeholder",
	},
	{
		id: "action",
		type: "text",
		value: "Text action row action",
	},
];
