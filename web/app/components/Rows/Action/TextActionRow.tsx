import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function TextActionRow() {
	// if (dragging.value === "TextActionRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "placeholder", type: "text" },
	// 		{ id: "action", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Text action row title</p>
			<div className="flex justify-between">
				<p className="text-evy-light">Placeholder</p>
				<button type="button" className="text-evy-blue">
					Action
				</button>
			</div>
		</div>
	);
}
