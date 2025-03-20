import React from "react";

export default function TextSelectRow() {
	return (
		<div className="p-2">
			<p className="pb-2">Text select row title</p>
			<div className="flex justify-between">
				<p className="text-evy-light">Option</p>
				<input
					id="checkbox"
					type="checkbox"
					value=""
					className="w-4 h-4 bg-evy-gray border-evy-gray rounded"
				/>
			</div>
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
