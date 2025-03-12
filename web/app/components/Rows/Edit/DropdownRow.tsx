import React from "react";
import Input from "../../input.tsx";

// import { dragging, configuration } from "../../Draggable.tsx";

export default function DropdownRow() {
	// if (dragging.value === "DropdownRow") {
	// 	configuration.value = [{ id: "title", type: "text" }];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Dropdown row</p>
			<div className="relative">
				<Input />
				<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
					<img className="h-4" src="/arrow_down.svg" alt="Select" />
				</div>
			</div>
		</div>
	);
}
