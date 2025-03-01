import React from "react";

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
	].map((Row) => (
		<div key={Row.name}>
			<div className="border-b">
				<Row />
			</div>
		</div>
	));

	return (
		<div className="h-screen flex flex-col overflow-hidden">
			<div className="border-b p-4 flex-shrink-0">
				<Logo />
			</div>
			<div className="flex flex-1 overflow-hidden">
				<div
					className="border-r overflow-y-auto"
					style={{ width: panelWidth }}
				>
					{rows}
				</div>
				<div className="flex-1 overflow-y-auto"></div>
				<div
					className="border-l overflow-y-auto"
					style={{ width: panelWidth }}
				>
					<div className="p-2">right</div>
				</div>
			</div>
		</div>
	);
}
