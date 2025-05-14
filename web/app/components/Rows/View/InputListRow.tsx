import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import Input from "@/app/design-system/input.tsx";

import { RowConfig } from "../../row.tsx";

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
			<Input />
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
];
