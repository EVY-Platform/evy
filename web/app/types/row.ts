import type React from "react";

export interface RowValidation {
	required?: string;
	message?: string;
	minAmount?: string;
	minValue?: string;
	minCharacters?: string;
}

export interface RowEdit {
	destination?: string;
	validation?: RowValidation;
}

export interface RowActionConfig {
	target: string;
}

export interface RowContent {
	title: string;
	children?: Row[];
	child?: Row;
	[key: string]: string | string[] | Row[] | Row | undefined;
}

export interface RowView {
	content: RowContent;
	data?: string;
	max_lines?: string;
}

export interface RowConfig {
	type: string;
	view: RowView;
	edit?: RowEdit;
	action?: RowActionConfig;
}

export type Row = {
	id: string;
	row: React.ReactNode;
	config: RowConfig;
};

export type ContainerType = "child" | "children";
