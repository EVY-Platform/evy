import React, { useContext } from "react";

import { AppContext } from "@/app/registry.tsx";

import { RowConfig } from "../../row.tsx";

export default function CalendarRow({ rowId }: { rowId: string }) {
	const { pages } = useContext(AppContext);
	const row = pages
		.flatMap((page) => page.rowsData)
		.find((r) => r.rowId === rowId);
	return (
		<div className="p-2">
			<p className="pb-2">
				{row?.config.find((c) => c.id === "title")?.value ??
					"Calendar row title"}
			</p>
			<img
				src="/calendar.png"
				alt="calendar"
				className="pointer-events-none"
			/>
		</div>
	);
}

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
		value: "Calendar row title",
	},
];
