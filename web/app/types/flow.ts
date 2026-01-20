import type { Row, RowConfig, RowView } from "./row";

export type Page = {
	id: string;
	title: string;
	rows: Row[];
	footer?: Row;
};

export type Flow = {
	id: string;
	name: string;
	type: "read" | "write";
	data: string;
	pages: Page[];
};

// Server types necessary to ingest the raw flows
// since in client-side type we need to have the concrete
// row instances
export type ServerRowContent = {
	title: string;
	children?: ServerRow[];
	child?: ServerRow;
	[key: string]: string | string[] | ServerRow[] | ServerRow | undefined;
};

export type ServerRow = Omit<RowConfig, "view"> & {
	id: string;
	view: Omit<RowView, "content"> & {
		content: ServerRowContent;
	};
};

export type ServerPage = Omit<Page, "rows" | "footer"> & {
	rows: ServerRow[];
	footer?: ServerRow;
};

export type ServerFlow = Omit<Flow, "pages"> & {
	pages: ServerPage[];
};
