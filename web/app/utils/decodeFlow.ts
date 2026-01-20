import { createElement } from "react";

import type {
	Row,
	ServerFlow,
	ServerRow,
	ServerPage,
	Flow,
	Page,
	ServerRowContent,
} from "../types";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";

function encodeRow(row: Row): ServerRow {
	const content = row.config.view.content;

	// Build the encoded content, converting Row children/child to ServerRow
	const encodedContent: ServerRowContent = { title: content.title };

	// Copy over all string/string[] properties
	for (const key of Object.keys(content)) {
		if (key === "children") {
			if (content.children) {
				encodedContent.children = content.children.map((child: Row) =>
					encodeRow(child)
				);
			}
		} else if (key === "child") {
			if (content.child) {
				encodedContent.child = encodeRow(content.child);
			}
		} else {
			const value = content[key];
			if (typeof value === "string" || Array.isArray(value)) {
				encodedContent[key] = value as string | string[];
			}
		}
	}

	return {
		id: row.id,
		type: row.config.type,
		view: {
			...row.config.view,
			content: encodedContent,
		},
		edit: row.config.edit,
		action: row.config.action,
	};
}

export function encodeFlow(flow: Flow): ServerFlow {
	return {
		...flow,
		pages: flow.pages.map((page: Page) => ({
			...page,
			rows: page.rows.map(encodeRow),
			footer: page.footer ? encodeRow(page.footer) : undefined,
		})),
	};
}

function decodeRow(row: ServerRow): Row {
	const baseRow = baseRows.find(
		(baseRow) => row.type === baseRow.config.type
	);
	if (!baseRow) {
		return {
			id: row.id,
			row: createElement(UnknownRow, { rowId: row.id }),
			config: UnknownRow.config,
		};
	}
	return {
		id: row.id,
		row: createElement(baseRow, { rowId: row.id }),
		config: {
			...row,
			view: {
				...row.view,
				content: {
					...row.view.content,
					title:
						typeof row.view.content.title === "string"
							? row.view.content.title
							: "Invalid title",
					children: row.view.content.children?.map(
						(child: ServerRow) => decodeRow(child)
					),
					child: row.view.content.child
						? decodeRow(row.view.content.child)
						: undefined,
				},
			},
		},
	};
}

export const decodeFlows = (flows: ServerFlow[]): Flow[] => {
	return flows.map((flow) => ({
		...flow,
		pages: flow.pages.map((page: ServerPage) => ({
			...page,
			rows: page.rows.map(decodeRow),
			footer: page.footer ? decodeRow(page.footer) : undefined,
		})),
	}));
};
