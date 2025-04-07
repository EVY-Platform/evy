"use client";

import { PageData } from "./components/page.tsx";
import { RowData } from "./components/row.tsx";

import InfoRow, {
	config as InfoRowConfig,
} from "./components/rows/View/infoRow.tsx";
import InputListRow, {
	config as InputListRowConfig,
} from "./components/rows/View/inputListRow.tsx";
import TextRow, {
	config as TextRowConfig,
} from "./components/rows/View/textRow.tsx";
import ButtonRow, {
	config as ButtonRowConfig,
} from "./components/rows/Action/buttonRow.tsx";
import TextActionRow, {
	config as TextActionRowConfig,
} from "./components/rows/Action/textActionRow.tsx";
import CalendarRow, {
	config as CalendarRowConfig,
} from "./components/rows/Edit/calendarRow.tsx";
import DropdownRow, {
	config as DropdownRowConfig,
} from "./components/rows/Edit/dropdownRow.tsx";
import InlinePickerRow, {
	config as InlinePickerRowConfig,
} from "./components/rows/Edit/inlinePickerRow.tsx";
import InputRow, {
	config as InputRowConfig,
} from "./components/rows/Edit/inputRow.tsx";
import SearchRow, {
	config as SearchRowConfig,
} from "./components/rows/Edit/searchRow.tsx";
import SelectPhotoRow, {
	config as SelectPhotoRowConfig,
} from "./components/rows/Edit/selectPhotoRow.tsx";
import TextAreaRow, {
	config as TextAreaRowConfig,
} from "./components/rows/Edit/textAreaRow.tsx";
import TextSelectRow, {
	config as TextSelectRowConfig,
} from "./components/rows/Edit/textSelectRow.tsx";

export function getPages(): PageData[] {
	return [
		{
			pageId: "Step 1",
			rowsData: [],
		},
		{
			pageId: "Step 2",
			rowsData: [],
		},
	];
}

export function getBaseRows(): RowData[] {
	return [
		{
			rowId: "InfoRow",
			row: <InfoRow />,
			config: InfoRowConfig,
		},
		{
			rowId: "TextRow",
			row: <TextRow />,
			config: TextRowConfig,
		},
		{
			rowId: "InputListRow",
			row: <InputListRow />,
			config: InputListRowConfig,
		},
		{
			rowId: "ButtonRow",
			row: <ButtonRow />,
			config: ButtonRowConfig,
		},
		{
			rowId: "TextActionRow",
			row: <TextActionRow />,
			config: TextActionRowConfig,
		},
		{
			rowId: "CalendarRow",
			row: <CalendarRow />,
			config: CalendarRowConfig,
		},
		{
			rowId: "DropdownRow",
			row: <DropdownRow />,
			config: DropdownRowConfig,
		},
		{
			rowId: "InlinePickerRow",
			row: <InlinePickerRow />,
			config: InlinePickerRowConfig,
		},
		{
			rowId: "InputRow",
			row: <InputRow />,
			config: InputRowConfig,
		},
		{
			rowId: "SearchRow",
			row: <SearchRow />,
			config: SearchRowConfig,
		},
		{
			rowId: "SelectPhotoRow",
			row: <SelectPhotoRow />,
			config: SelectPhotoRowConfig,
		},
		{
			rowId: "TextAreaRow",
			row: <TextAreaRow />,
			config: TextAreaRowConfig,
		},
		{
			rowId: "TextSelectRow",
			row: <TextSelectRow />,
			config: TextSelectRowConfig,
		},
	];
}
