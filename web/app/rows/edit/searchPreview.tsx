import { createElement, useMemo, type ReactNode } from "react";

import type { FlowsContextValue } from "../../state/contexts/FlowsContext";
import { FlowsContext } from "../../state/contexts/FlowsContext";
import type { Row } from "../../types/row";
import {
	SEARCH_DEFAULT_RESULT_CONTENT,
	SEARCH_PREVIEW_DATUM,
	SEARCH_PREVIEW_RESULT_COUNT,
} from "../../utils/searchRowDefaults";
import type { RowComponent } from "../defineRow";
import ButtonRow from "../action/ButtonRow";
import TextActionRow from "../action/TextActionRow";
import CalendarRow from "./CalendarRow";
import DropdownRow from "./DropdownRow";
import InlinePickerRow from "./InlinePickerRow";
import InputRow from "./InputRow";
import SelectPhotoRow from "./SelectPhotoRow";
import TextAreaRow from "./TextAreaRow";
import TextSelectRow from "./TextSelectRow";
import { RowLayout } from "../design-system/RowLayout";
import InfoRow from "../view/InfoRow";
import InputListRow from "../view/InputListRow";
import TextRow from "../view/TextRow";

const previewRowComponents: Record<string, RowComponent> = {
	Button: ButtonRow,
	Calendar: CalendarRow,
	Dropdown: DropdownRow,
	Info: InfoRow,
	InlinePicker: InlinePickerRow,
	Input: InputRow,
	InputList: InputListRow,
	SelectPhoto: SelectPhotoRow,
	Text: TextRow,
	TextAction: TextActionRow,
	TextArea: TextAreaRow,
	TextSelect: TextSelectRow,
};

type SearchPreviewDatum = Record<string, string>;

function SearchPreviewFallback({ rowType }: { rowType: string }) {
	return (
		<RowLayout title="">
			<p className="evy-p-2 evy-text-sm evy-text-gray">
				Preview unavailable for `{rowType}` result rows
			</p>
		</RowLayout>
	);
}

function resolveDatumValue(path: string, datum: SearchPreviewDatum): string {
	const normalizedPath = path.trim();
	if (!normalizedPath) {
		return datum.value ?? "";
	}

	return datum[normalizedPath] ?? "";
}

export function formatSearchPreviewString(
	template: string,
	datum: SearchPreviewDatum = SEARCH_PREVIEW_DATUM,
): string {
	return template.replace(/\{datum(?:\.([^}]+))?\}/g, (_match, path?: string) =>
		resolveDatumValue(path ?? "", datum),
	);
}

function formatSearchPreviewContentStrings(
	value: unknown,
	datum: SearchPreviewDatum,
): unknown {
	if (typeof value === "string") {
		return formatSearchPreviewString(value, datum);
	}

	if (Array.isArray(value)) {
		return value.map((entry) =>
			formatSearchPreviewContentStrings(entry, datum),
		);
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, nestedValue]) => [
				key,
				formatSearchPreviewContentStrings(nestedValue, datum),
			]),
		);
	}

	return value;
}

function flattenPreviewRows(row: Row): Row[] {
	const child = row.config.view.content.child;
	const children = row.config.view.content.children ?? [];

	return [
		row,
		...(child ? flattenPreviewRows(child) : []),
		...children.flatMap(flattenPreviewRows),
	];
}

function buildPreviewRowElement(rowType: string, rowId: string): ReactNode {
	const RowComponent = previewRowComponents[rowType];
	if (!RowComponent) {
		return <SearchPreviewFallback rowType={rowType} />;
	}

	return createElement(RowComponent, { key: rowId, rowId });
}

function buildDefaultSearchPreviewChild(parentRowId: string): Row {
	const id = `${parentRowId}:search-preview-default`;

	return {
		id,
		row: createElement(InfoRow, { key: id, rowId: id }),
		config: {
			type: "Info",
			source: "",
			destination: "",
			actions: [],
			view: {
				content: {
					...SEARCH_DEFAULT_RESULT_CONTENT,
				},
			},
		},
	};
}

function cloneSearchPreviewRow(
	row: Row,
	datum: SearchPreviewDatum,
	previewId: string,
): Row {
	const child = row.config.view.content.child;
	const children = row.config.view.content.children;
	const {
		child: _ignoredChild,
		children: _ignoredChildren,
		...contentWithoutRows
	} = row.config.view.content;

	const formattedChild = child
		? cloneSearchPreviewRow(child, datum, `${previewId}:child`)
		: undefined;
	const formattedChildren = children?.map((nestedChild, index) =>
		cloneSearchPreviewRow(
			nestedChild,
			datum,
			`${previewId}:children:${index.toString()}`,
		),
	);

	return {
		id: previewId,
		row: buildPreviewRowElement(row.config.type, previewId),
		config: {
			...row.config,
			view: {
				...row.config.view,
				content: {
					...(formatSearchPreviewContentStrings(
						contentWithoutRows,
						datum,
					) as typeof contentWithoutRows),
					...(formattedChild ? { child: formattedChild } : {}),
					...(formattedChildren ? { children: formattedChildren } : {}),
				},
			},
		},
	};
}

export function buildSearchPreviewRows(
	templateRow: Row | undefined,
	parentRowId: string,
	datum: SearchPreviewDatum = SEARCH_PREVIEW_DATUM,
): Row[] {
	const previewTemplate =
		templateRow ?? buildDefaultSearchPreviewChild(parentRowId);

	return Array.from({ length: SEARCH_PREVIEW_RESULT_COUNT }, (_unused, index) =>
		cloneSearchPreviewRow(
			previewTemplate,
			datum,
			`${parentRowId}:search-preview:${index.toString()}`,
		),
	);
}

export function SearchPreviewResults({
	templateRow,
	parentRowId,
}: {
	templateRow: Row | undefined;
	parentRowId: string;
}) {
	const previewRows = useMemo(
		() => buildSearchPreviewRows(templateRow, parentRowId),
		[templateRow, parentRowId],
	);
	const flattenedRows = useMemo(
		() => previewRows.flatMap(flattenPreviewRows),
		[previewRows],
	);
	const previewContextValue = useMemo<FlowsContextValue>(
		() => ({
			rows: flattenedRows,
			flows: [],
			focusMode: false,
			configStack: [],
			dispatchRow: () => {},
		}),
		[flattenedRows],
	);

	if (previewRows.length === 0) {
		return null;
	}

	return (
		<FlowsContext.Provider value={previewContextValue}>
			<div className="evy-mt-2 evy-flex evy-flex-col">
				{previewRows.map((previewRow) => (
					<div
						key={previewRow.id}
						className="evy-border-0 evy-border-t evy-border-solid evy-border-gray-light"
					>
						{previewRow.row}
					</div>
				))}
			</div>
		</FlowsContext.Provider>
	);
}
