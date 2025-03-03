import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export default function Draggable({
	id,
	children,
}: {
	id: string;
	children: React.ReactNode;
}) {
	const { attributes, listeners, setNodeRef, transform } = useDraggable({
		id,
	});

	const style = {
		transform: CSS.Translate.toString(transform),
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...listeners}
			{...attributes}
			className="mb-2 bg-white cursor-move border border-gray-200 hover:border-blue-500"
		>
			{children}
		</div>
	);
}
