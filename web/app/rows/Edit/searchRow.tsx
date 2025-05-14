import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";
import Input from "@/app/design-system/input.tsx";
import InlineIcon from "@/app/design-system/inline-icon";

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
				<InlineIcon icon="/search.svg" alt="Search" />
				<Input
					value={
						row?.config.find((c) => c.id === "value")?.value ??
						"Search row value"
					}
					placeholder={
						row?.config.find((c) => c.id === "placeholder")
							?.value ?? "Search row placeholder"
					}
					offset="left"
				/>
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
	{
		id: "value",
		type: "text",
		value: "Search row value",
	},
];
