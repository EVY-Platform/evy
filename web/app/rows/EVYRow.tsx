import React, { ReactNode } from "react";
import { AppContext } from "../registry";

export type Row = {
	rowId: string;
	row: React.ReactNode;
	config: RowConfig;
};
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
	action?: RowAction;
}

export abstract class EVYRow extends React.Component<{
	rowId: string;
}> {
	static config: RowConfig;

	abstract renderContent(row: Row): ReactNode;

	static getRowsRecursive(row: Row): Row[] {
		return [
			row,
			...(row.config.view.content.child
				? EVYRow.getRowsRecursive(row.config.view.content.child)
				: []),
			...(row.config.view.content.children
				? row.config.view.content.children.flatMap(
						EVYRow.getRowsRecursive
				  )
				: []),
		].filter((row) => row !== undefined);
	}

	override render() {
		return (
			<AppContext.Consumer>
				{({ rows, flows, activeFlowId }) => {
					const baseRow = rows.find(
						(r) => r.rowId === this.props.rowId
					);
					if (baseRow) return this.renderContent(baseRow);

					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row = pages
						.flatMap((page) => page.rows)
						.flatMap(EVYRow.getRowsRecursive)
						.find((r) => r.rowId === this.props.rowId);
					if (row) return this.renderContent(row);

					return (
						<div className="evy-p-2">
							<p>Unknown row</p>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}

export class UnknownRow extends EVYRow {
	static override config: RowConfig = {
		type: "Unknown",
		view: {
			content: {
				title: "Unknown row",
			},
		},
	};

	renderContent(row: Row) {
		return (
			<div className="evy-p-2">
				<p>{row.config.view.content.title}</p>
			</div>
		);
	}
}
