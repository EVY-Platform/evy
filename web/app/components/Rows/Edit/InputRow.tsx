import React from "react";
import Input from "../../shared/input.tsx";

// import { dragging, configuration } from "../../Draggable.tsx";

export default function InputRow() {
	// if (dragging.value === "InputRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "placeholder", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Input row title</p>
			<Input />
		</div>
	);
}
