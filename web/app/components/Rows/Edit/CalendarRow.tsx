import React from "react";
import { RowConfig } from "../../row";

export default function CalendarRow() {
	return (
		<div className="p-2">
			<p className="pb-2">Calendar row title</p>
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
	},
];
