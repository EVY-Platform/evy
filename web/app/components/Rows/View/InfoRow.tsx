import React from "react";
// import { dragging, configuration } from "../../Draggable.tsx";

export default function InfoRow() {
	// if (dragging.value === "InfoRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "info", type: "text" },
	// 	];
	// }

	return (
		<div className="p-2">
			<p className="pb-2">Info row title</p>
			<p className="text-evy-light">
				Lorem Ipsum is simply dummy text of the printing and typesetting
				industry.
			</p>
		</div>
	);
}
