import type { Locator, Page } from "@playwright/test";
import type { ServerFlow } from "../app/registry.tsx";

// Common selectors used across tests
export const SELECTORS = {
	phoneContainer: 'div[class*="evy-bg-phone"]',
	pageContent: '[class*="evy-overflow-scroll"]',
	rowContainer:
		'div[class*="evy-flex"][class*="evy-flex-col"][class*="evy-w-full"]',
	draggableRow: "div[data-row-id]",
	dropIndicator: ".evy-v-dropzone.expanded, .evy-h-dropzone.expanded",
	topIndicator: ".evy-v-dropzone.expanded.evy-mt-2, .evy-h-dropzone.expanded",
	bottomIndicator:
		".evy-v-dropzone.expanded.evy-mb-2, .evy-h-dropzone.expanded",
};

// Helper functions for common locator patterns
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

// Drag helper with stabilization wait to prevent flaky tests
export async function stableDragTo(
	page: Page,
	source: Locator,
	target: Locator,
) {
	await source.dragTo(target);
	await page.waitForTimeout(150);
}

type TestPage = {
	id: string;
	title: string;
	rows?: ServerFlow["pages"][number]["rows"];
};

function createTestFlows(pages: TestPage[]): ServerFlow[] {
	return [
		{
			id: "test-flow",
			name: "Test Flow",
			type: "write",
			data: "",
			pages: pages.map((page) => ({
				...page,
				rows: page.rows || [],
			})),
		},
	];
}

export async function initTestFlows(page: Page, pages: TestPage[]) {
	await page.addInitScript((flows: ServerFlow[]) => {
		(window as { __TEST_FLOWS__?: ServerFlow[] }).__TEST_FLOWS__ = flows;
	}, createTestFlows(pages));
}
