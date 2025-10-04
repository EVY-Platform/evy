import React, { ReactNode } from "react";

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

export interface RowAction {
	target: string;
}

export interface RowContent {
	[key: string]: string;
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
	action?: RowAction;
}

export abstract class EVYRow extends React.Component<{
	rowId: string;
}> {
	static config: RowConfig;

	abstract renderContent(): ReactNode;

	override render() {
		return this.renderContent();
	}
}
