import { expect, type Locator, type Page } from "@playwright/test";
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
	secondarySheetPage: '[data-testid="secondary-sheet-page"]',
	loadingMessage: 'div:text-is("Loading flows...")',
	errorMessage: 'div:text-is("Failed to load flows")',
};

/** Selects the first canvas page so side panels stay open (they auto-collapse when no page is selected). */
export async function ensureSidePanelsExpanded(page: Page): Promise<void> {
	const rowsLabel = page.getByText("Rows", { exact: true }).first();
	if (await rowsLabel.isVisible()) {
		return;
	}
	await getFirstPage(page).getByRole("button").first().click();
	await expect(rowsLabel).toBeVisible();
}

export async function getRowsPanel(page: Page): Promise<Locator> {
	await ensureSidePanelsExpanded(page);
	return page.getByText("Rows", { exact: true }).first().locator("..");
}

export async function getSidebarRow(
	page: Page,
	text: string,
): Promise<Locator> {
	const rowsPanel = await getRowsPanel(page);
	return rowsPanel.getByText(text, { exact: true }).locator("..");
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

export function getConfigPanel(page: Page): Locator {
	return page.getByText("Configuration", { exact: true }).locator("..");
}

/** Flow picker is visible when the app has finished loading (real API or injected flows). */
export async function waitForAppLoaded(page: Page): Promise<void> {
	await expect(page.locator(SELECTORS.flowSelector)).toBeVisible();
}

export async function openFlowPicker(page: Page): Promise<void> {
	await page.locator(SELECTORS.flowSelector).click();
}

export async function selectFlowByLabel(
	page: Page,
	label: string,
): Promise<void> {
	await openFlowPicker(page);
	await page
		.getByRole("listbox", { name: "Active flow" })
		.getByRole("option", { name: label, exact: true })
		.click();
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

/** Loads injected full flow JSON and opens the app (same pattern as component tests that use `initFullFlows`). */
export async function openAppWithFullFlows(
	page: Page,
	flows: ServerFlow[],
): Promise<void> {
	await initFullFlows(page, flows);
	await page.goto("/");
}

export async function popoverSelect(
	page: Page,
	trigger: Locator,
	optionLabel: string,
): Promise<void> {
	await trigger.click();
	await page
		.getByRole("listbox")
		.getByRole("option", { name: optionLabel, exact: true })
		.click();
}

export function getSecondarySheetPage(page: Page): Locator {
	return page.locator(SELECTORS.secondarySheetPage);
}

/** Clicks the phone canvas then the breadcrumb so the configuration panel is in page focus mode. */
export async function enterCanvasFocusModeByPageTitle(
	page: Page,
	pageTitle: string,
): Promise<void> {
	await getFirstPage(page).click();
	await page.getByRole("button", { name: `Select page ${pageTitle}` }).click();
}

/** Opens a sheet’s secondary page via its first matching child type button in the configuration panel. */
export async function openSecondarySheetChildFromConfigPanel(
	page: Page,
	options: { sheetTitle?: string; firstChildButtonName?: string } = {},
): Promise<void> {
	const sheetTitle = options.sheetTitle ?? "My Sheet";
	const firstChildButtonName = options.firstChildButtonName ?? "Text";
	await page.getByText(sheetTitle, { exact: true }).click();
	const configPanel = getConfigPanel(page);
	const childButton = configPanel
		.getByRole("button", { name: firstChildButtonName })
		.first();
	await expect(childButton).toBeVisible();
	await childButton.click();
}

/** Common drag-and-drop tests fixture: two empty pages. */
export async function setupTwoEmptyTestPages(page: Page): Promise<void> {
	await initTestFlows(page, [
		{ id: "step_1", title: "Page 1", rows: [] },
		{ id: "step_2", title: "Page 2", rows: [] },
	]);
	await page.goto("/");
}

/** Asserts `laterSubstring` appears after `earlierSubstring` in page canvas draggable rows. */
export async function expectDraggableSubrowOrder(
	pageContent: Locator,
	earlierSubstring: string,
	laterSubstring: string,
): Promise<void> {
	const allRows = await pageContent.locator(SELECTORS.draggableRow).all();
	let earlierIndex = -1;
	let laterIndex = -1;
	for (let i = 0; i < allRows.length; i++) {
		const rowText = await allRows[i].textContent().catch(() => "");
		if (rowText?.includes(earlierSubstring) && earlierIndex === -1) {
			earlierIndex = i;
		}
		if (rowText?.includes(laterSubstring) && laterIndex === -1) {
			laterIndex = i;
		}
	}
	expect(earlierIndex).not.toBe(-1);
	expect(laterIndex).not.toBe(-1);
	expect(laterIndex).toBeGreaterThan(earlierIndex);
}
