"use client";

import { RowType } from "./row.tsx";

import InfoRow from "../rows/View/infoRow.tsx";
import InputListRow from "../rows/View/inputListRow.tsx";
import TextRow from "../rows/View/textRow.tsx";

import ButtonRow from "../rows/Action/buttonRow.tsx";
import TextActionRow from "../rows/Action/textActionRow.tsx";

import CalendarRow from "../rows/Edit/calendarRow.tsx";
import DropdownRow from "../rows/Edit/dropdownRow.tsx";
import InlinePickerRow from "../rows/Edit/inlinePickerRow.tsx";
import InputRow from "../rows/Edit/inputRow.tsx";
import SearchRow from "../rows/Edit/searchRow.tsx";
import SelectPhotoRow from "../rows/Edit/selectPhotoRow.tsx";
import TextAreaRow from "../rows/Edit/textAreaRow.tsx";
import TextSelectRow from "../rows/Edit/textSelectRow.tsx";

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
