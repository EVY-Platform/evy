import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import { RowConfig } from "../../row.tsx";

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
			<textarea
				id="message"
				rows={4}
				className="block p-2 w-full text-sm rounded-sm border border-evy-border border-opacity-50 focus-visible:outline-none resize-none"
				placeholder={
					row?.config.find((c) => c.id === "placeholder")?.value ??
					"Text area row placeholder"
				}
			></textarea>
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
];
