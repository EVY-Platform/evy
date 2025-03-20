import React from "react";

export default function ButtonRow() {
	return (
		<div className="p-2 flex justify-center">
			<button
				type="button"
				className="rounded-sm text-sm px-3 py-3 text-white bg-evy-gray hover:bg-black"
			>
				Button row text
			</button>
		</div>
	);
}

export const config = [
	{
		id: "text",
		type: "text",
	},
];
