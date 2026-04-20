import { expect, test } from "@playwright/test";
import type { UI_Flow, UI_Row } from "evy-types";
import { Client } from "rpc-websockets";

import {
	createNewFlowThroughPicker,
	ensureSidePanelsExpanded,
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getSidebarRow,
	openFlowPicker,
	selectFlowByLabel,
	SELECTORS,
	waitForAppLoaded,
} from "../tests/utils";

const API_POLL_TIMEOUT_MS = 10_000;

function getApiUrl(): string {
	const apiUrl = process.env.API_URL;
	if (!apiUrl) {
		throw new Error("API_URL is not set");
	}
	return apiUrl;
}

async function withApiClient<T>(
	run: (client: Client) => Promise<T>,
): Promise<T> {
	const client = new Client(getApiUrl());

	await new Promise<void>((resolve, reject) => {
		const onOpen = () => {
			client.removeListener("error", onError);
			resolve();
		};
		const onError = (error: Error) => {
			client.removeListener("open", onOpen);
			reject(error);
		};

		client.on("open", onOpen);
		client.on("error", onError);
	});

	try {
		return await run(client);
	} finally {
		client.close();
	}
}

async function getFlowsFromApi(): Promise<UI_Flow[]> {
	return withApiClient(async (client) => {
		const result = await client.call("get", {
			service: "evy",
			resource: "sdui",
		});
		return result as UI_Flow[];
	});
}

function rowContainsTitle(row: UI_Row, title: string): boolean {
	if (row.view.content.title === title) {
		return true;
	}

	if (
		row.view.content.child &&
		rowContainsTitle(row.view.content.child, title)
	) {
		return true;
	}

	return (row.view.content.children ?? []).some((child) =>
		rowContainsTitle(child, title),
	);
}

function flowContainsRowTitle(
	flow: UI_Flow | undefined,
	title: string,
): boolean {
	if (!flow) {
		return false;
	}

	return flow.pages.some((page) => {
		if (page.footer && rowContainsTitle(page.footer, title)) {
			return true;
		}

		return page.rows.some((row) => rowContainsTitle(row, title));
	});
}

async function expectFlowPersisted(flowName: string): Promise<void> {
	await expect
		.poll(
			async () => {
				const flows = await getFlowsFromApi();
				return flows.some((flow) => flow.name === flowName);
			},
			{ timeout: API_POLL_TIMEOUT_MS },
		)
		.toBe(true);
}

async function expectFlowRowTitlePersisted(
	flowName: string,
	rowTitle: string,
): Promise<void> {
	await expect
		.poll(
			async () => {
				const flows = await getFlowsFromApi();
				const flow = flows.find((candidate) => candidate.name === flowName);
				return flowContainsRowTitle(flow, rowTitle);
			},
			{ timeout: API_POLL_TIMEOUT_MS },
		)
		.toBe(true);
}

/**
 * E2E Integration tests that run against real API services.
 * These tests do NOT inject mock data - they test the full stack.
 * Note: Tests should be resilient to empty database state.
 */

test.describe.configure({ mode: "serial" });

test.describe("Web E2E Integration Tests", () => {
	test("should persist a newly created flow after page refresh", async ({
		page,
	}) => {
		const uniqueFlowName = `E2E New Flow ${Date.now()}`;

		await page.goto("/");
		await waitForAppLoaded(page);

		await createNewFlowThroughPicker(page, uniqueFlowName);
		await expect(page.getByTestId("create-flow-dialog")).not.toBeVisible();
		await expect(page.locator(SELECTORS.flowSelector)).toContainText(
			uniqueFlowName,
		);
		await expectFlowPersisted(uniqueFlowName);

		await page.reload();
		await waitForAppLoaded(page);

		await openFlowPicker(page);
		await expect(
			page
				.getByRole("listbox", { name: "Active flow" })
				.getByRole("option", { name: uniqueFlowName, exact: true }),
		).toBeVisible();
	});

	test("should persist a sidebar row dropped on canvas after page refresh", async ({
		page,
	}) => {
		const uniqueFlowName = `E2E Row Flow ${Date.now()}`;

		await page.goto("/");
		await waitForAppLoaded(page);

		await createNewFlowThroughPicker(page, uniqueFlowName);
		await expect(page.getByTestId("create-flow-dialog")).not.toBeVisible();

		await ensureSidePanelsExpanded(page);
		const sidebarRow = await getSidebarRow(page, "Info row title");
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		await expect(
			getFirstPage(page).getByText("Info row title", { exact: true }),
		).toBeVisible();
		await expectFlowRowTitlePersisted(uniqueFlowName, "Info row title");

		await page.reload();
		await waitForAppLoaded(page);
		await selectFlowByLabel(page, uniqueFlowName);

		await expect(
			getFirstPage(page).getByText("Info row title", { exact: true }),
		).toBeVisible();
	});

	test("should persist SDUI edits after page refresh", async ({ page }) => {
		const uniqueTitle = `E2E Test Title ${Date.now()}`;

		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");

		const textRow = page.getByText("My item is called", { exact: true });
		await expect(textRow).toBeVisible();

		await textRow.click();

		const configPanel = getConfigPanel(page);
		const titleInput = configPanel.getByLabel("title", { exact: true });
		await expect(titleInput).toBeVisible();

		await titleInput.clear();
		await titleInput.fill(uniqueTitle);
		await expect(titleInput).toHaveValue(uniqueTitle);
		await expectFlowRowTitlePersisted("View Item", uniqueTitle);

		await page.reload();
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");

		const editedRow = page.getByText(uniqueTitle, { exact: true });
		await expect(editedRow).toBeVisible();

		await editedRow.click();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue(uniqueTitle);
	});

	test("should display footer row when page has one", async ({ page }) => {
		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, "View Item");
		await expect(page.locator(SELECTORS.flowSelector)).not.toHaveAttribute(
			"data-value",
			"",
		);

		const footerButton = getFirstPage(page)
			.getByRole("button", { name: "Go home" })
			.first();
		await expect(footerButton).toBeVisible();
	});
});
