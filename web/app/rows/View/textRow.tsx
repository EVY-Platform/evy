import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";

export default function TextRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Text row title"}
			</p>
			<p>
				{row?.config.find((c) => c.id === "placeholder")?.value ??
					"Text row placeholder"}
			</p>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Text row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Text row placeholder",
	},
];
