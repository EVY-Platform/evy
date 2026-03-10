import { createElement } from "react";
import type {
	SDUI_Flow as ServerFlow,
	SDUI_Page as ServerPage,
	SDUI_Row as ServerRow,
	SDUI_RowContent as ServerRowContent,
} from "evy-types";

import type { Row } from "../types/row";
import type { SDUI_Flow, SDUI_Page } from "../types/flow";
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
					encodeRow(child),
				);
			}
		} else if (key === "child") {
			if (content.child) {
				encodedContent.child = encodeRow(content.child);
			}
		} else {
			const value = content[key];
			if (typeof value === "string") {
				encodedContent[key] = value;
			} else if (
				Array.isArray(value) &&
				value.every((x): x is string => typeof x === "string")
			) {
				encodedContent[key] = value;
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
		destination: row.config.destination,
		actions: row.config.actions,
	};
}

export function encodeFlow(flow: SDUI_Flow): ServerFlow {
	return {
		...flow,
		pages: flow.pages.map((page: SDUI_Page) => ({
			...page,
			rows: page.rows.map(encodeRow),
			footer: page.footer ? encodeRow(page.footer) : undefined,
		})),
	};
}

function decodeRow(row: ServerRow): Row {
	const baseRow = baseRows.find((baseRow) => row.type === baseRow.config.type);
	if (!baseRow) {
		return {
			id: row.id,
			row: createElement(UnknownRow, { key: row.id, rowId: row.id }),
			config: UnknownRow.config,
		};
	}
	return {
		id: row.id,
		row: createElement(baseRow, { key: row.id, rowId: row.id }),
		config: {
			...row,
			actions: row.actions ?? [],
			view: {
				...row.view,
				content: {
					...row.view.content,
					title:
						typeof row.view.content.title === "string"
							? row.view.content.title
							: "Invalid title",
					children: row.view.content.children?.map((child: ServerRow) =>
						decodeRow(child),
					),
					child: row.view.content.child
						? decodeRow(row.view.content.child)
						: undefined,
				},
			},
		},
	};
}

export const decodeFlows = (flows: ServerFlow[]): SDUI_Flow[] => {
	return flows.map((flow) => ({
		...flow,
		pages: flow.pages.map((page: ServerPage) => ({
			...page,
			rows: page.rows.map(decodeRow),
			footer: page.footer ? decodeRow(page.footer) : undefined,
		})),
	}));
};
