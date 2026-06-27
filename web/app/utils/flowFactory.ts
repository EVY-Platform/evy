import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";

const NOW = () => new Date().toISOString();

export function buildNewPageRecord(): DATA_EVY_Page {
	const ts = NOW();
	return {
		id: crypto.randomUUID(),
		name: "Page",
		title: "",
		rowIds: [],
		createdAt: ts,
		updatedAt: ts,
	};
}

export function buildNewFlowRecords(name: string): {
	flow: DATA_EVY_Flow;
	page: DATA_EVY_Page;
} {
	const ts = NOW();
	const page = buildNewPageRecord();
	const flow: DATA_EVY_Flow = {
		id: crypto.randomUUID(),
		name,
		pageIds: [page.id],
		createdAt: ts,
		updatedAt: ts,
	};
	return { flow, page };
}
