"use client";

import { RowType } from "./components/row.tsx";

import InfoRow from "./components/rows/View/infoRow.tsx";
import InputListRow from "./components/rows/View/inputListRow.tsx";
import TextRow from "./components/rows/View/textRow.tsx";

import ButtonRow from "./components/rows/Action/buttonRow.tsx";
import TextActionRow from "./components/rows/Action/textActionRow.tsx";

import CalendarRow from "./components/rows/Edit/calendarRow.tsx";
import DropdownRow from "./components/rows/Edit/dropdownRow.tsx";
import InlinePickerRow from "./components/rows/Edit/inlinePickerRow.tsx";
import InputRow from "./components/rows/Edit/inputRow.tsx";
import SearchRow from "./components/rows/Edit/searchRow.tsx";
import SelectPhotoRow from "./components/rows/Edit/selectPhotoRow.tsx";
import TextAreaRow from "./components/rows/Edit/textAreaRow.tsx";
import TextSelectRow from "./components/rows/Edit/textSelectRow.tsx";

export function getBasePages() {
	return {
		rows: [
			{
				rowId: "InfoRow",
				row: <InfoRow />,
			},
			{
				rowId: "TextRow",
				row: <TextRow />,
			},
			{
				rowId: "InputListRow",
				row: <InputListRow />,
			},
			{
				rowId: "ButtonRow",
				row: <ButtonRow />,
			},
			{
				rowId: "TextActionRow",
				row: <TextActionRow />,
			},
			{
				rowId: "CalendarRow",
				row: <CalendarRow />,
			},
			{
				rowId: "DropdownRow",
				row: <DropdownRow />,
			},
			{
				rowId: "InlinePickerRow",
				row: <InlinePickerRow />,
			},
			{
				rowId: "InputRow",
				row: <InputRow />,
			},
			{
				rowId: "SearchRow",
				row: <SearchRow />,
			},
			{
				rowId: "SelectPhotoRow",
				row: <SelectPhotoRow />,
			},
			{
				rowId: "TextAreaRow",
				row: <TextAreaRow />,
			},
			{
				rowId: "TextSelectRow",
				row: <TextSelectRow />,
			},
		],
		pagesData: {
			"Step 1": {
				pageId: "Step 1",
				rows: [],
			},
			"Step 2": {
				pageId: "Step 2",
				rows: [],
			},
		},
		pagesOrder: ["Step 1", "Step 2"],
	};
}
