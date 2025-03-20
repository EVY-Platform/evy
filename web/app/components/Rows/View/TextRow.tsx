import React from "react";

export default function TextRow() {
	return (
		<div className="p-2">
			<p className="pb-2">Text row title</p>
			<p>
				Lorem Ipsum is simply dummy text of the printing and typesetting
				industry.
			</p>
		</div>
	);
}

export const config = [
	{
		id: "title",
		type: "text",
	},
	{
		id: "placeholder",
		type: "text",
	},
];
