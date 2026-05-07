import type { Page } from "@playwright/test";
import type {
	UI_Flow as ServerFlow,
	UI_RowAction as RowAction,
	UI_Row as ServerRow,
	UI_RowContent as ServerRowContent,
} from "evy-types";

// Input types where id is optional
// Using explicit interface to avoid index signature conflicts with ServerRowContent
interface ServerRowInputContent {
	title: string;
	children?: ServerRowInput[];
	child?: ServerRowInput;
	value?: string;
	placeholder?: string;
	text?: string;
	subtitle?: string;
	label?: string;
	format?: string;
	segments?: string[];
}

interface ServerRowInput {
	id?: string;
	type: ServerRow["type"];
	source?: string;
	view: {
		content: ServerRowInputContent;
		max_lines?: string;
	};
	destination?: string;
	actions: RowAction[];
}

interface ServerPageInput {
	id?: string;
	title: string;
	rows?: ServerRowInput[];
	footer?: ServerRowInput;
}

function ensureRowId(row: ServerRowInput): ServerRow {
	const inputContent = row.view.content;
	const { children, child, ...contentRest } = inputContent;

	const content: ServerRowContent = {
		...contentRest,
		...(children !== undefined ? { children: ensureRowIds(children) } : {}),
		...(child !== undefined ? { child: ensureRowId(child) } : {}),
	};

	return {
		id: row.id ?? crypto.randomUUID(),
		type: row.type,
		view: {
			content,
			max_lines: row.view.max_lines,
		},
		source: row.source ?? "",
		destination: row.destination,
		actions: row.actions,
	};
}

function ensureRowIds(rows: ServerRowInput[]): ServerRow[] {
	return rows.map(ensureRowId);
}

export function createTestFlows(pages: ServerPageInput[]): ServerFlow[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Test Flow",
			pages: pages.map((page) => ({
				id: page.id ?? crypto.randomUUID(),
				title: page.title,
				rows: ensureRowIds(page.rows ?? []),
				footer: page.footer ? ensureRowId(page.footer) : undefined,
			})),
		},
	];
}

export async function initTestFlows(
	page: Page,
	pages: ServerPageInput[],
): Promise<void> {
	await page.addInitScript((flows: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flows;
	}, createTestFlows(pages));
}

export async function initFullFlows(
	page: Page,
	flows: ServerFlow[],
): Promise<void> {
	await page.addInitScript((flowData: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flowData;
	}, flows);
}

/** Loads injected full flow JSON and opens the app (same pattern as component tests that use `initFullFlows`). */
export async function openAppWithFullFlows(
	page: Page,
	flows: ServerFlow[],
): Promise<void> {
	await initFullFlows(page, flows);
	await page.goto("/");
}

/** Injects simplified page fixtures via `initTestFlows` and opens the app. */
export async function openAppWithTestFlows(
	page: Page,
	pages: Parameters<typeof initTestFlows>[1],
): Promise<void> {
	await initTestFlows(page, pages);
	await page.goto("/");
}
