import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function TextRow() {
	// if (dragging.value === "TextRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "text", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Text row title</p>
			<p>
				Lorem Ipsum is simply dummy text of the printing and typesetting
				industry.
			</p>
		</div>
	);
}
