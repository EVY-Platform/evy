import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function TextSelectRow() {
	// if (dragging.value === "TextSelectRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "text", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Text select row title</p>
			<div className="flex justify-between">
				<p className="text-evy-light">Option</p>
				<input
					id="checkbox"
					type="checkbox"
					value=""
					className="w-4 h-4 bg-evy-gray border-evy-gray rounded"
				/>
			</div>
		</div>
	);
}
