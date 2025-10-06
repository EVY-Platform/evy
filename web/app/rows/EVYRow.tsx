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
export interface RowChild {
	title: string;
	child: Row;
}

export interface RowContent {
	title: string;
	children?: Row[];
	child?: Row;
	[key: string]: string | Row[] | RowConfig[] | Row | undefined;
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

export class UnknownRow extends EVYRow {
	static override config: RowConfig = {
		type: "Unknown",
		view: {
			content: {
				title: "Unknown row",
			},
		},
	};

	renderContent() {
		return (
			<AppContext.Consumer>
				{({ flows, activeFlowId }) => {
					const pages =
						flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row =
						pages
							.flatMap((page) => page.rows)
							.find((r) => r.rowId === this.props.rowId) ??
						UnknownRow;

					return (
						<div className="evy-p-2">
							<p>{row.config.view.content.title}</p>
						</div>
					);
				}}
			</AppContext.Consumer>
		);
	}
}
