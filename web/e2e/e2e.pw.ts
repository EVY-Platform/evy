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
} from "../integration/utils";

const API_POLL_TIMEOUT_MS = 10_000;
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "Web";

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
		const result = (await client.call("get", {
			service: "evy",
			resource: "sdui",
		})) as UI_Flow[];
		return Array.isArray(result) ? result : [];
	});
}

async function createFlowInApi(flow: UI_Flow): Promise<void> {
	await withApiClient(async (client) => {
		await client.login({ token: TEST_TOKEN, os: TEST_OS });
		await client.call("create", {
			service: "evy",
			resource: "sdui",
			data: flow,
		});
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

	test("should keep existing child pages visible while opening nested child rows", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 2200, height: 1700 });
		const uniqueFlowName = `E2E Child Page Flow ${Date.now()}`;
		const firstChild: UI_Row = {
			id: crypto.randomUUID(),
			type: "Text",
			source: "",
			actions: [],
			view: {
				content: {
					title: "E2E First Child Row",
					text: "First child text",
					child: {
						id: crypto.randomUUID(),
						type: "Text",
						source: "",
						actions: [],
						view: {
							content: {
								title: "E2E Second Child Row",
								text: "Second child text",
								child: {
									id: crypto.randomUUID(),
									type: "Text",
									source: "",
									actions: [],
									view: {
										content: {
											title: "E2E Third Child Row",
											text: "Third child text",
										},
									},
								},
							},
						},
					},
				},
			},
		};
		const parentRow: UI_Row = {
			id: crypto.randomUUID(),
			type: "Info",
			source: "",
			actions: [],
			view: {
				content: {
					title: "E2E Parent Row",
					subtitle: "Parent subtitle",
					icon: "",
					child: firstChild,
				},
			},
		};
		await createFlowInApi({
			id: crypto.randomUUID(),
			name: uniqueFlowName,
			pages: [
				{
					id: crypto.randomUUID(),
					title: "E2E Child Page",
					rows: [parentRow],
				},
			],
		});

		await page.goto("/");
		await waitForAppLoaded(page);
		await selectFlowByLabel(page, uniqueFlowName);

		await getFirstPage(page)
			.getByText("E2E Parent Row", { exact: true })
			.click();

		let childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(1);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(2);

		await childPages
			.nth(0)
			.getByText("E2E First Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(2);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(1).getByText("E2E Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);

		await childPages
			.nth(1)
			.getByText("E2E Second Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(3);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(1).getByText("E2E Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(2).getByText("E2E Third Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-child-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(4);

		await childPages
			.nth(2)
			.getByText("E2E Third Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("child-page");
		await expect(childPages).toHaveCount(3);
		await expect(page.getByTestId("blank-child-page")).toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(5);
		await expectFlowRowTitlePersisted(uniqueFlowName, "E2E Third Child Row");
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
