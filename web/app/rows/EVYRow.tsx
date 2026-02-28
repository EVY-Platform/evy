import React, { type ReactNode } from "react";

import { AppContext } from "../state";
import type { Row, RowConfig, ContainerType } from "../types";

// Re-export types for backward compatibility
export type { Row, RowConfig, RowView, ContainerType } from "../types";

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
				? row.config.view.content.children.flatMap(EVYRow.getRowsRecursive)
				: []),
		].filter((row) => row !== undefined);
	}

	static findContainerOfRow(
		rowId: string,
		rows: Row[],
	): { container: Row; type: ContainerType } | null {
		for (const row of rows) {
			if (row.id === rowId) return null;

			const childMatches = row.config.view.content.child?.id === rowId;
			if (childMatches) return { container: row, type: "child" };

			const childrenMatch = row.config.view.content.children?.some(
				(r) => r.id === rowId,
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
					row.config.view.content.children,
				);
				if (childrenOfChildren) return childrenOfChildren;
			}
		}
		return null;
	}

	static findContainerById(
		rowId: string,
		rows: Row[],
	): { container: Row; type: ContainerType } | null {
		for (const row of rows) {
			if ("child" in row.config.view.content && row.id === rowId) {
				return { container: row, type: "child" };
			}

			if ("children" in row.config.view.content && row.id === rowId) {
				return { container: row, type: "children" };
			}

			if (row.config.view.content.child) {
				const child = EVYRow.findContainerById(rowId, [
					row.config.view.content.child,
				]);
				if (child) return child;
			}

			if (row.config.view.content.children) {
				const children = EVYRow.findContainerById(
					rowId,
					row.config.view.content.children,
				);
				if (children) return children;
			}
		}
		return null;
	}

	static traverseToRowAndGetPath(
		row: Row,
		targetRowId: string,
	): Array<number | "child"> {
		if (row.id === targetRowId) return [];

		const child = row.config.view.content.child;
		if (child?.id === targetRowId) {
			const path = EVYRow.traverseToRowAndGetPath(child, targetRowId);
			if (path.length > 0) return ["child", ...path];
		}

		const children = row.config.view.content.children;
		if (children) {
			for (const [index, c] of children.entries()) {
				if (c.id === targetRowId) return [index];

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
					const baseRow = rows.find((r) => r.id === this.props.rowId);
					if (baseRow) return this.renderContent(baseRow);

					const pages = flows.find((f) => f.id === activeFlowId)?.pages || [];
					const row = pages
						.flatMap((page) => page.rows)
						.flatMap(EVYRow.getRowsRecursive)
						.find((r) => r.id === this.props.rowId);
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
