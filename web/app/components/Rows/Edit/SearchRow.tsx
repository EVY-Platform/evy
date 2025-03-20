import React from "react";
import Input from "../../input.tsx";
import { RowConfig } from "../../row.tsx";

export default function SearchRow() {
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

export const config: RowConfig = [
	{
		id: "title",
		type: "text",
	},
	{
		id: "placeholder",
		type: "text",
	},
];
