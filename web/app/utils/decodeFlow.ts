import { createElement } from "react";

import type { Row, ServerFlow, ServerRow, ServerPage, Flow } from "../types";
import { baseRows } from "../rows/baseRows";
import { UnknownRow } from "../rows/EVYRow";

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
