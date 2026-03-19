import type { Locator, Page } from "@playwright/test";
import type {
	SDUI_Flow as ServerFlow,
	SDUI_RowAction as RowAction,
	SDUI_Row as ServerRow,
	SDUI_RowContent as ServerRowContent,
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
	label?: string;
	segments?: string[];
}

interface ServerRowInput {
	id?: string;
	type: ServerRow["type"];
	view: {
		content: ServerRowInputContent;
		data?: string;
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

export const SELECTORS = {
	phoneContainer: 'div[class*="evy-bg-phone"]',
	pageContent: '[class*="evy-overflow-scroll"]',
	rowContainer:
		'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]',
	draggableRow: 'div[data-row-id]:not([data-row-id="placeholder"])',
	dropIndicator: ".evy-v-dropzone.expanded, .evy-h-dropzone.expanded",
	topIndicator: ".evy-v-dropzone.expanded.evy-mt-2, .evy-h-dropzone.expanded",
	bottomIndicator:
		".evy-v-dropzone.expanded.evy-mb-2, .evy-h-dropzone.expanded",
	flowSelector: "#flow-select",
	loadingMessage: 'div:text-is("Loading flows...")',
	errorMessage: 'div:text-is("Failed to load flows")',
};

export function getRowsPanel(page: Page): Locator {
	return page.getByText("Rows", { exact: true }).first().locator("..");
}

export function getSidebarRow(page: Page, text: string): Locator {
	return getRowsPanel(page).getByText(text, { exact: true }).locator("..");
}

export function getFirstPage(page: Page): Locator {
	return page.locator(SELECTORS.phoneContainer).first();
}

export function getPageContent(page: Page, pageIndex = 0): Locator {
	return page
		.locator(SELECTORS.phoneContainer)
		.nth(pageIndex)
		.locator(SELECTORS.pageContent);
}

export function getPageRow(page: Page, text: string, pageIndex = 0): Locator {
	return page
		.locator(SELECTORS.phoneContainer)
		.nth(pageIndex)
		.getByText(text, { exact: true })
		.locator("..")
		.locator("..");
}

export function getDropIndicator(page: Page): Locator {
	return page.locator(SELECTORS.dropIndicator);
}

export function getLoadingState(page: Page): Locator {
	return page.getByText("Loading flows...", { exact: true });
}

export function getErrorState(page: Page): Locator {
	return page.getByText("Failed to load flows", { exact: true });
}

function ensureRowId(row: ServerRowInput): ServerRow {
	const inputContent = row.view.content;
	const content: ServerRowContent = {
		title: inputContent.title,
	};

	if (inputContent.value !== undefined) {
		content.value = inputContent.value;
	}
	if (inputContent.placeholder !== undefined) {
		content.placeholder = inputContent.placeholder;
	}
	if (inputContent.text !== undefined) {
		content.text = inputContent.text;
	}
	if (inputContent.label !== undefined) {
		content.label = inputContent.label;
	}
	if (inputContent.segments !== undefined) {
		content.segments = inputContent.segments;
	}

	if (inputContent.children) {
		content.children = ensureRowIds(inputContent.children);
	}
	if (inputContent.child) {
		content.child = ensureRowId(inputContent.child);
	}

	return {
		id: row.id ?? crypto.randomUUID(),
		type: row.type,
		view: {
			content,
			data: row.view.data,
			max_lines: row.view.max_lines,
		},
		destination: row.destination,
		actions: row.actions,
	};
}

function ensureRowIds(rows: ServerRowInput[]): ServerRow[] {
	return rows.map(ensureRowId);
}

function createTestFlows(pages: ServerPageInput[]): ServerFlow[] {
	return [
		{
			id: crypto.randomUUID(),
			name: "Test Flow",
			type: "create",
			data: "",
			pages: pages.map((page) => ({
				id: page.id ?? crypto.randomUUID(),
				title: page.title,
				rows: ensureRowIds(page.rows ?? []),
				footer: page.footer ? ensureRowId(page.footer) : undefined,
			})),
		},
	];
}
export async function initTestFlows(page: Page, pages: ServerPageInput[]) {
	await page.addInitScript((flows: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flows;
	}, createTestFlows(pages));
}

export async function initFullFlows(page: Page, flows: ServerFlow[]) {
	await page.addInitScript((flowData: ServerFlow[]) => {
		window.__TEST_FLOWS__ = flowData;
	}, flows);
}
