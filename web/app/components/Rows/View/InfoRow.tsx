import React from "react";

export default function InfoRow() {
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

export const config = [
	{
		id: "title",
		type: "text",
	},
	{
		id: "info",
		type: "text",
	},
];
