import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import Input from "@/app/design-system/input.tsx";

import { RowConfig } from "../../row.tsx";

export default function SearchRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Search row title"}
			</p>
			<div className="relative">
				<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
					<img className="h-4" src="/search.svg" alt="Search" />
				</div>
				<Input />
			</div>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Search row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Search row placeholder",
	},
];
