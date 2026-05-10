import { expect, type Locator, type Page } from "@playwright/test";

import { openAppWithTestFlows } from "./flowFixtures";

export const SELECTORS = {
	phoneContainer: "[data-canvas-page-frame]",
	pageContent: '[class*="evy-overflow-scroll"]',
	rowContainer:
		'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]',
	draggableRow: 'div[data-row-id]:not([data-row-id="placeholder"])',
	dropIndicator: ".evy-v-dropzone, .evy-h-dropzone",
	topIndicator: ".evy-v-dropzone.evy-top-0, .evy-h-dropzone.evy-left-0",
	bottomIndicator: ".evy-v-dropzone.evy-bottom-0, .evy-h-dropzone.evy-right-0",
	flowSelector: "#flow-select",
	secondarySheetPage: '[data-testid="secondary-sheet-page"]',
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
	const row = rowsPanel.getByText(text, { exact: true }).locator("..");
	await row.scrollIntoViewIfNeeded();
	return row;
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

/** Canvas row in the phone, from the row title (two parents up to the card). */
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
	const trigger = page.locator(SELECTORS.flowSelector);
	await trigger.click();
	await expect(
		page.getByRole("listbox", { name: "Active flow" }),
	).toBeVisible();
}

/** Opens the flow picker, chooses "Create new flow", fills the name, and submits. */
export async function createNewFlowThroughPicker(
	page: Page,
	flowName: string,
): Promise<void> {
	await openFlowPicker(page);
	await page
		.getByRole("option", { name: "Create new flow", exact: true })
		.click();
	const createFlowDialog = page.getByTestId("create-flow-dialog");
	await expect(createFlowDialog).toBeVisible();
	await createFlowDialog.getByLabel("Flow name").fill(flowName);
	await createFlowDialog
		.getByRole("button", { name: "Create", exact: true })
		.click();
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

/** `addInitScript` that replaces `WebSocket` with a class whose constructor throws. */
export async function installConstructorFailingWebSocket(
	page: Page,
	message: string,
): Promise<void> {
	await page.addInitScript((msg: string) => {
		window.WebSocket = class {
			constructor() {
				throw new Error(msg);
			}
		} as unknown as typeof WebSocket;
	}, message);
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

/** Clicks the phone canvas then the breadcrumb so the page is active with no row selected. */
export async function selectPageByTitle(
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
	await openAppWithTestFlows(page, [
		{ id: "step_1", title: "Page 1", rows: [] },
		{ id: "step_2", title: "Page 2", rows: [] },
	]);
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
