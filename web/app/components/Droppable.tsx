import React from "react";
import { useDroppable } from "@dnd-kit/core";

export default function Droppable({
	id,
	children,
}: {
	id: string;
	children: React.ReactNode;
}) {
	const { isOver, setNodeRef } = useDroppable({ id });

	const style = {
		backgroundColor: isOver ? "#f0f9ff" : "#f8fafc",
	};

	return (
		<div ref={setNodeRef} style={style} className="w-full">
			{children}
		</div>
	);
}
