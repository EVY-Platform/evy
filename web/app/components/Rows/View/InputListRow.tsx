import React from "react";
import Input from "../../input.tsx";
import { RowConfig } from "../../row.tsx";

export default function InputListRow() {
	return (
		<div className="p-2">
			<p className="pb-2">Input list row title</p>
			<Input />
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
