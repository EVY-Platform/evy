import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";
import { RowConfig } from "@/app/components/row.tsx";
import TextArea from "@/app/rows/design-system/text-area";

export default function TextAreaRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);

	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Text area row title"}
			</p>
			<TextArea
				placeholder={
					row?.config.find((c) => c.id === "placeholder")?.value ??
					"Text area row placeholder"
				}
				value={
					row?.config.find((c) => c.id === "value")?.value ??
					"Text area row value"
				}
			/>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Text area row title",
	},
	{
		id: "placeholder",
		type: "text",
		value: "Text area row placeholder",
	},
	{
		id: "value",
		type: "text",
		value: "Text area row value",
	},
];
