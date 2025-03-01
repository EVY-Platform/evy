import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function CalendarRow() {
	// if (dragging.value === "CalendarRow") {
	// 	configuration.value = [{ id: "title", type: "text" }];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Calendar row title</p>
			<img src="/calendar.png" alt="calendar" />
		</div>
	);
}
