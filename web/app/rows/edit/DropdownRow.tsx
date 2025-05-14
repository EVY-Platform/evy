import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/Row";
import Dropdown from "@/app/rows/design-system/Dropdown";

export default function DropdownRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Dropdown row title"}
			</p>
			<Dropdown
				value={
					row?.config.find((c) => c.id === "value")?.value ??
					"Dropdown row value"
				}
				placeholder={
					row?.config.find((c) => c.id === "placeholder")?.value ??
					"Dropdown row placeholder"
				}
			/>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Dropdown row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Dropdown row placeholder",
	},
	{
		id: "value",
		type: "text",
		value: "Dropdown row value",
	},
];
