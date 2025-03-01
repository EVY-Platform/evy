import React from "react";
import Input from "../../../components/Input.tsx";

// import { dragging, configuration } from "../../Draggable.tsx";

export default function InputListRow() {
	// if (dragging.value === "InputListRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "placeholder", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Input list row title</p>
			<Input />
		</div>
	);
}
