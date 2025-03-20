import React from "react";

export default function SelectPhotoRow() {
	return (
		<div className="p-2">
			<p className="pb-2">Select photo row</p>
			<div className="rounded-md px-8 py-8 border border-evy-border border-opacity-50 text-sm">
				<div className="flex justify-center text-center flex-col">
					<img className="h-4" src="/add_photo.svg" alt="Add photo" />
					<p>Content text</p>
				</div>
			</div>
			<p className="text-evy-light text-sm">Subtitle text</p>
		</div>
	);
}

export const config = [
	{
		id: "content",
		type: "text",
	},
	{
		id: "subtitle",
		type: "text",
	},
];
