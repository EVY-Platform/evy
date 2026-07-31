import type { DATA_EVY_Flow, DATA_EVY_Page } from "evy-types";

const NOW = () => new Date().toISOString();

export function buildNewPageRecord(): DATA_EVY_Page {
	const ts = NOW();
	return {
		id: crypto.randomUUID(),
		name: "Page",
		title: "",
		row_ids: [],
		created_at: ts,
		updated_at: ts,
		visibility: "public",
	};
}

export function buildNewFlowRecords(
	name: string,
	submits?: { resource: string },
): {
	flow: DATA_EVY_Flow;
	page: DATA_EVY_Page;
} {
	const ts = NOW();
	const page = buildNewPageRecord();
	const flow: DATA_EVY_Flow = {
		id: crypto.randomUUID(),
		name,
		page_ids: [page.id],
		created_at: ts,
		updated_at: ts,
		visibility: "public",
		...(submits !== undefined ? { submits } : {}),
	};
	return { flow, page };
}
