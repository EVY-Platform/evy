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

type RowEntry = {
	element: HTMLElement;
};

export type RegisterRowArgs = {
	rowId: string;
	rowEntry: RowEntry;
};
export type Registry = {
	registerRow: (args: RegisterRowArgs) => () => void;
};

export type PageData = {
	pageId: string;
	items: RowType[];
};
export type PagesData = {
	rows: RowType[];
	pagesData: { [pageId: string]: PageData };
	pagesOrder: string[];
};

export function getBasePages() {
	// const rows = [
	// 	InfoRow,
	// 	TextRow,
	// 	InputListRow,

	// 	ButtonRow,
	// 	TextActionRow,

	// 	CalendarRow,
	// 	DropdownRow,
	// 	InlinePickerRow,
	// 	InputRow,
	// 	SearchRow,
	// 	SelectPhotoRow,
	// 	TextAreaRow,
	// 	TextSelectRow,
	// ];

	return {
		rows: [
			{
				rowId: "TextRowSource",
				name: "TextRow",
			},
			{
				rowId: "InfoRowSource",
				name: "InfoRow",
			},
			{
				rowId: "ButtonRowSource",
				name: "ButtonRow",
			},
			{
				rowId: "ListRowSource",
				name: "ListRow",
			},
			{
				rowId: "CalendarRowSource",
				name: "CalendarRow",
			},
			{
				rowId: "DropdownRowSource",
				name: "DropdownRow",
			},
			{
				rowId: "TextRowSource2",
				name: "TextRow2",
			},
			{
				rowId: "InfoRowSource2",
				name: "InfoRow2",
			},
			{
				rowId: "ButtonRowSource2",
				name: "ButtonRow2",
			},
			{
				rowId: "ListRowSource2",
				name: "ListRow2",
			},
			{
				rowId: "CalendarRowSource2",
				name: "CalendarRow2",
			},
			{
				rowId: "DropdownRowSource2",
				name: "DropdownRow2",
			},
			{
				rowId: "TextRowSource3",
				name: "TextRow3",
			},
			{
				rowId: "InfoRowSource3",
				name: "InfoRow3",
			},
			{
				rowId: "ButtonRowSource3",
				name: "ButtonRow3",
			},
			{
				rowId: "ListRowSource3",
				name: "ListRow3",
			},
			{
				rowId: "CalendarRowSource3",
				name: "CalendarRow3",
			},
			{
				rowId: "DropdownRowSource3",
				name: "DropdownRow3",
			},
			{
				rowId: "TextRowSource4",
				name: "TextRow4",
			},
			{
				rowId: "InfoRowSource4",
				name: "InfoRow4",
			},
			{
				rowId: "ButtonRowSource4",
				name: "ButtonRow4",
			},
			{
				rowId: "ListRowSource4",
				name: "ListRow4",
			},
			{
				rowId: "CalendarRowSource4",
				name: "CalendarRow4",
			},
			{
				rowId: "DropdownRowSource4",
				name: "DropdownRow4",
			},
		],
		pagesData: {
			"Step 1": {
				pageId: "Step 1",
				items: [
					{
						rowId: "TextRow",
						name: "TextRow",
					},
					{
						rowId: "InfoRow",
						name: "InfoRow",
					},
				],
			},
			"Step 2": {
				pageId: "Step 2",
				items: [
					{
						rowId: "ButtonRow",
						name: "ButtonRow",
					},
					{
						rowId: "ListRow",
						name: "ListRow",
					},
				],
			},
		},
		pagesOrder: ["Step 1", "Step 2"],
	};
}

export default function createRegistry(): Registry {
	const rows = new Map<string, RowEntry>();

	function registerRow({ rowId, rowEntry }: RegisterRowArgs): () => void {
		rows.set(rowId, rowEntry);
		return function cleanup() {
			rows.delete(rowId);
		};
	}

	return { registerRow };
}
