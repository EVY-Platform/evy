import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import { RowConfig } from "../../row.tsx";

export default function InfoRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Info row title"}
			</p>
			<p className="text-evy-light">
				{row?.config.find((c) => c.id === "info")?.value ??
					"Info row info"}
			</p>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Info row title",
	},
	{
		id: "info",
		type: "text",
		value: "Info row info",
	},
];
