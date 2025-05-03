import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import Input from "../../input.tsx";
import { RowConfig } from "../../row.tsx";

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
			<div className="relative">
				<Input />
				<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
					<img className="h-4" src="/arrow_down.svg" alt="Select" />
				</div>
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Dropdown row title",
	},
];
