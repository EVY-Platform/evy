import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";
import Input from "@/app/design-system/input.tsx";

export default function InputListRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Input list row title"}
			</p>
			<Input
				value={
					row?.config.find((c) => c.id === "value")?.value ??
					"Input list row value"
				}
				placeholder={
					row?.config.find((c) => c.id === "placeholder")?.value ??
					"Input list row placeholder"
				}
			/>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Input list row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Input placeholder",
	},
	{
		id: "value",
		type: "text",
		value: "Input value",
	},
];
