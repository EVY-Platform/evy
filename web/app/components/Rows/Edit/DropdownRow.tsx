import React from "react";
import Input from "../../input.tsx";
import { RowConfig } from "../../row.tsx";

export default function DropdownRow() {
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

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
	},
];
