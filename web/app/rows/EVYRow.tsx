import React, { type ReactNode } from "react";
import { AppContext } from "../registry";

export type Row = {
	rowId: string;
	row: React.ReactNode;
	config: RowConfig;
};

interface RowValidation {
	required?: string;
	message?: string;
	minAmount?: string;
	minValue?: string;
	minCharacters?: string;
}

interface RowEdit {
	destination?: string;
	validation?: RowValidation;
}

interface RowAction {
	target: string;
}

interface RowContent {
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

export type ContainerType = "child" | "children";

export const containerDropindicatorId = "placeholder";

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

	static findContainerOfRow(
		rowId: string,
		rows: Row[]
	): { container: Row; type: ContainerType } | null {
		for (const row of rows) {
			if (row.rowId === rowId) return null;

			const childMatches = row.config.view.content.child?.rowId === rowId;
			if (childMatches) return { container: row, type: "child" };

			const childrenMatch = row.config.view.content.children?.some(
				(r) => r.rowId === rowId
			);
			if (childrenMatch) return { container: row, type: "children" };

			if (row.config.view.content.child) {
				const childrenOfChild = EVYRow.findContainerOfRow(rowId, [
					row.config.view.content.child,
				]);
				if (childrenOfChild) return childrenOfChild;
			}

			if (row.config.view.content.children) {
				const childrenOfChildren = EVYRow.findContainerOfRow(
					rowId,
					row.config.view.content.children
				);
				if (childrenOfChildren) return childrenOfChildren;
			}
		}
		return null;
	}

	static pickContainerRow(
		rowId: string,
		rows: Row[]
	): { container: Row; type: ContainerType } | null {
		for (const row of rows) {
			if (row.rowId !== rowId) continue;

			const canHaveChild = row.config.view.content.child;
			if (canHaveChild) return { container: row, type: "child" };

			const canHaveChildren = row.config.view.content.children;
			if (canHaveChildren) return { container: row, type: "children" };
		}
		return null;
	}

	static traverseToRowAndGetPath(
		row: Row,
		targetRowId: string
	): Array<number | "child"> {
		if (row.rowId === targetRowId) return [];

		const child = row.config.view.content.child;
		if (child) {
			return [
				"child",
				...EVYRow.traverseToRowAndGetPath(child, targetRowId),
			];
		}

		const children = row.config.view.content.children;
		if (children) {
			for (const [index, c] of children.entries()) {
				if (c.rowId === targetRowId) return [index];

				const path = EVYRow.traverseToRowAndGetPath(c, targetRowId);
				if (path.length > 0) return [index, ...path];
			}
		}
		return [];
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
