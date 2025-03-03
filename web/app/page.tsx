"use client";

import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
	DndContext,
	DragEndEvent,
	DragStartEvent,
	closestCenter,
	UniqueIdentifier,
	DragOverlay,
} from "@dnd-kit/core";

import Draggable from "./components/Draggable.tsx";
import Droppable from "./components/Droppable.tsx";

import Logo from "./components/Logo.tsx";

import InfoRow from "./components/Rows/View/InfoRow.tsx";
import InputListRow from "./components/Rows/View/InputListRow.tsx";
import TextRow from "./components/Rows/View/TextRow.tsx";

import ButtonRow from "./components/Rows/Action/ButtonRow.tsx";
import TextActionRow from "./components/Rows/Action/TextActionRow.tsx";

import CalendarRow from "./components/Rows/Edit/CalendarRow.tsx";
import DropdownRow from "./components/Rows/Edit/DropdownRow.tsx";
import InlinePickerRow from "./components/Rows/Edit/InlinePickerRow.tsx";
import InputRow from "./components/Rows/Edit/InputRow.tsx";
import SearchRow from "./components/Rows/Edit/SearchRow.tsx";
import SelectPhotoRow from "./components/Rows/Edit/SelectPhotoRow.tsx";
import TextAreaRow from "./components/Rows/Edit/TextAreaRow.tsx";
import TextSelectRow from "./components/Rows/Edit/TextSelectRow.tsx";

const panelWidth = "280px";

type ContainersType = {
	[key: string]: React.JSX.Element[];
};
const containers: ContainersType = {
	"Container 1": [],
	"Container 2": [],
};

export default function Page() {
	const rows = [
		InfoRow,
		TextRow,
		InputListRow,

		ButtonRow,
		TextActionRow,

		CalendarRow,
		DropdownRow,
		InlinePickerRow,
		InputRow,
		SearchRow,
		SelectPhotoRow,
		TextAreaRow,
		TextSelectRow,
	];

	const [phones, setPhones] = useState<ContainersType>(containers);
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

	function handleDragStart(event: DragStartEvent) {
		setActiveId(event.active.id);
	}

	function handleDragEnd(event: DragEndEvent) {
		setActiveId(null);

		if (!event.active?.id) return;

		const newContainerId = event.over?.id;
		const sourceContainerId = Object.keys(phones).find((containerId) =>
			phones[containerId].some(
				(item) => item.props.id === event.active.id
			)
		);

		if (sourceContainerId) {
			setPhones((prev) => {
				const updatedContainers = { ...prev };
				updatedContainers[sourceContainerId].filter(
					(item: React.JSX.Element) =>
						item.props.id !== event.active.id
				);
				return updatedContainers;
			});
		} else if (newContainerId && sourceContainerId !== newContainerId) {
			const Row = rows.find((row) => row.name === event.active.id);
			if (Row) {
				setPhones((prev) => {
					const updatedContainers = { ...prev };
					updatedContainers[newContainerId] = [
						...prev[newContainerId],
						<Row />,
					];
					return updatedContainers;
				});
			}
		}
	}

	return (
		<div className="h-screen flex flex-col overflow-hidden">
			<div className="border-b p-4">
				<Logo />
			</div>
			<div className="flex flex-1 overflow-hidden">
				<DndContext
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<div
						className="border-r overflow-y-auto"
						style={{ width: panelWidth }}
					>
						<div className="p-4 text-xl font-bold text-center">
							Rows
						</div>
						<Droppable key={"Source"} id={"Source"}>
							{rows.map((Row) => (
								<Draggable key={Row.name} id={Row.name}>
									<Row />
								</Draggable>
							))}
						</Droppable>
					</div>
					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-row space-x-4 p-4 h-full">
							{Object.entries(phones).map(
								([containerId, items]) => (
									<Droppable
										key={containerId}
										id={containerId}
									>
										{items.map((item) => (
											<Draggable key={item} id={item}>
												{item}
											</Draggable>
										))}
									</Droppable>
								)
							)}
						</div>
					</div>
					<div
						className="border-l overflow-y-auto"
						style={{ width: panelWidth }}
					>
						<div className="p-4 text-xl font-bold text-center">
							Configuration
						</div>
					</div>
					<DragOverlay>
						{activeId ? (
							<div className="p-4 bg-white rounded shadow border border-blue-500">
								{rows.find((row) => row.name === activeId)?.()}
							</div>
						) : null}
					</DragOverlay>
				</DndContext>
			</div>
		</div>
	);
}
