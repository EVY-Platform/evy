import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function TextAreaRow() {
	// if (dragging.value === "TextAreaRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "placeholder", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Text area row title</p>
			<textarea
				id="message"
				rows="4"
				className="block p-2 w-full text-sm rounded-sm border border-evy-border border-opacity-50 focus-visible:outline-none resize-none"
				placeholder=""
			></textarea>
		</div>
	);
}
