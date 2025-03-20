import React from "react";

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

export const config = [
	{
		id: "title",
		type: "text",
	},
];
