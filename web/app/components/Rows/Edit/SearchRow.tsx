import React from "react";
import Input from "../../input.tsx";

// import { dragging, configuration } from "../../Draggable.tsx";

export default function SearchRow() {
	// if (dragging.value === "SearchRow") {
	// 	configuration.value = [
	// 		{ id: "title", type: "text" },
	// 		{ id: "placeholder", type: "text" },
	// 	];
	// }
	return (
		<div className="p-2">
			<p className="pb-2">Search row</p>
			<div className="relative">
				<div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
					<img className="h-4" src="/search.svg" alt="Search" />
				</div>
				<Input />
			</div>
		</div>
	);
}
