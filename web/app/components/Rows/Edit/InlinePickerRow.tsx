import React from "react";

export default function InlinePickerRow() {
	const sharedStyles = "rounded-md text-sm px-3 py-3";
	return (
		<div className="p-2">
			<p className="pb-2">Inline picker row</p>
			<div className="p-2 flex gap-2">
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray-light text-black`}
				>
					1 min
				</button>
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray text-white`}
				>
					2 mins
				</button>
				<button
					type="button"
					className={`${sharedStyles} bg-evy-gray-light text-black`}
				>
					5 min
				</button>
			</div>
		</div>
	);
}

export const config = [
	{
		id: "title",
		type: "text",
	},
];
