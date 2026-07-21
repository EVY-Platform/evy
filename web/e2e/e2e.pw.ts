import { expect, test } from "@playwright/test";
import type {
	DATA_EVY_Flow,
	DATA_EVY_Page,
	DATA_EVY_Row,
	UI_Flow,
	UI_Row,
} from "evy-types";
import { EVY_CORE_RESOURCE, EVY_CORE_SERVICE } from "evy-types/coreResources";
import { Client } from "rpc-websockets";
import { decomposeServerFlow } from "../app/utils/serverFlowDecompose";
import {
	createNewFlowThroughPicker,
	ensureSidePanelsExpanded,
	getConfigPanel,
	getFirstPage,
	getPageContent,
	getSidebarRow,
	openFlowPicker,
	SELECTORS,
	selectFlowByLabel,
	waitForAppLoaded,
} from "../integration/utils";

const API_POLL_TIMEOUT_MS = 10_000;
const TEST_TOKEN = "e2e-test-token";
const TEST_OS = "Web";

type FlatFlowGraph = {
	flowRows: DATA_EVY_Flow[];
	pageRows: DATA_EVY_Page[];
	rowRows: DATA_EVY_Row[];
};

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
		const [flowRows, pageRows, rowRows] = await Promise.all([
			getFlatResourceRows<DATA_EVY_Flow>(client, EVY_CORE_RESOURCE.FLOWS),
			getFlatResourceRows<DATA_EVY_Page>(client, EVY_CORE_RESOURCE.PAGES),
			getFlatResourceRows<DATA_EVY_Row>(client, EVY_CORE_RESOURCE.ROWS),
		]);
		return assembleFlatFlows({ flowRows, pageRows, rowRows });
	});
}

async function getFlatResourceRows<T>(
	client: Client,
	resource: string,
): Promise<T[]> {
	const result = await client.call("get", {
		service: EVY_CORE_SERVICE,
		resource,
	});
	return Array.isArray(result) ? (result as T[]) : [];
}

async function createFlowInApi(flow: UI_Flow): Promise<void> {
	await withApiClient(async (client) => {
		await client.login({ token: TEST_TOKEN, os: TEST_OS });
		const graph = decomposeServerFlow(
			withFixtureNameFallbacks(flow),
			new Date().toISOString(),
		);
		for (const row of graph.rowRows) {
			await createFlatResource(client, EVY_CORE_RESOURCE.ROWS, row);
		}
		for (const page of graph.pageRows) {
			await createFlatResource(client, EVY_CORE_RESOURCE.PAGES, page);
		}
		for (const flow of graph.flowRows) {
			await createFlatResource(client, EVY_CORE_RESOURCE.FLOWS, flow);
		}
	});
}

async function createFlatResource(
	client: Client,
	resource: string,
	data: unknown,
): Promise<void> {
	await client.call("create", {
		service: EVY_CORE_SERVICE,
		resource,
		data,
	});
}

function assembleFlatFlows(records: FlatFlowGraph): UI_Flow[] {
	const pageById = new Map(records.pageRows.map((page) => [page.id, page]));
	const rowById = new Map(records.rowRows.map((row) => [row.id, row]));
	return records.flowRows.map((flow) => ({
		id: flow.id,
		name: flow.name,
		pages: flow.pageIds
			.map((pageId) => pageById.get(pageId))
			.filter((page): page is DATA_EVY_Page => Boolean(page))
			.map((page) => assemblePage(page, rowById)),
	}));
}

function assemblePage(page: DATA_EVY_Page, rowById: Map<string, DATA_EVY_Row>) {
	return {
		id: page.id,
		name: page.name,
		title: page.title ?? "",
		rows: page.rowIds
			.map((rowId) => assembleRow(rowId, rowById, new Set()))
			.filter((row): row is UI_Row => Boolean(row)),
		footer: page.footerRowId
			? assembleRow(page.footerRowId, rowById, new Set())
			: undefined,
	};
}

function assembleRow(
	rowId: string,
	rowById: Map<string, DATA_EVY_Row>,
	visitedRowIds: Set<string>,
): UI_Row | undefined {
	if (visitedRowIds.has(rowId)) return undefined;
	const row = rowById.get(rowId);
	if (!row) return undefined;

	const nextVisitedRowIds = new Set(visitedRowIds).add(rowId);
	const data = { ...row.data } as Record<string, unknown>;
	const childRowId = data.child_row_id;
	const sheetRowId = data.sheet_row_id;
	const childrenRowIds = data.children_row_ids;
	delete data.child_row_id;
	delete data.sheet_row_id;
	delete data.children_row_ids;

	const assembledRow: Record<string, unknown> = {
		...data,
		id: row.id,
		name: row.name,
		type: row.type,
		visible: row.visible,
	};
	if (typeof childRowId === "string") {
		assembledRow.child = assembleRow(
			childRowId,
			rowById,
			nextVisitedRowIds,
		);
	}
	if (typeof sheetRowId === "string") {
		assembledRow.sheet = assembleRow(
			sheetRowId,
			rowById,
			nextVisitedRowIds,
		);
	}
	if (Array.isArray(childrenRowIds)) {
		assembledRow.children = childrenRowIds
			.filter(
				(childRowId): childRowId is string =>
					typeof childRowId === "string",
			)
			.map((childRowId) =>
				assembleRow(childRowId, rowById, nextVisitedRowIds),
			)
			.filter((row): row is UI_Row => Boolean(row));
	}
	return assembledRow as UI_Row;
}

/**
 * Test fixtures omit name fields; fill the fallbacks the app would
 * derive, then reuse the app's decomposeServerFlow for the actual
 * nested-to-flat conversion.
 */
function withFixtureNameFallbacks(flow: UI_Flow): UI_Flow {
	return {
		...flow,
		pages: flow.pages.map((page) => ({
			...page,
			name: (page.name ?? page.title) || "Page",
			rows: page.rows.map(withRowNameFallbacks),
			footer: page.footer
				? withRowNameFallbacks(page.footer)
				: page.footer,
		})),
	};
}

function withRowNameFallbacks(row: UI_Row): UI_Row {
	return {
		...row,
		name: (row.name ?? row.title) || row.type,
		child: row.child ? withRowNameFallbacks(row.child) : row.child,
		sheet: row.sheet ? withRowNameFallbacks(row.sheet) : row.sheet,
		children: Array.isArray(row.children)
			? row.children.map(withRowNameFallbacks)
			: row.children,
	};
}

function rowContainsTitle(row: UI_Row, title: string): boolean {
	if (row.title === title) {
		return true;
	}

	if (row.child && rowContainsTitle(row.child, title)) {
		return true;
	}

	if (row.sheet && rowContainsTitle(row.sheet, title)) {
		return true;
	}

	return (row.children ?? []).some((child) => rowContainsTitle(child, title));
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
				const flow = flows.find(
					(candidate) => candidate.name === flowName,
				);
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
		const sidebarRow = await getSidebarRow(page, "Text row title");
		const pageContent = getPageContent(page);
		await sidebarRow.dragTo(pageContent);

		await expect(
			getFirstPage(page).getByText("Text row title", { exact: true }),
		).toBeVisible();
		await expectFlowRowTitlePersisted(uniqueFlowName, "Text row title");

		await page.reload();
		await waitForAppLoaded(page);
		await selectFlowByLabel(page, uniqueFlowName);

		await expect(
			getFirstPage(page).getByText("Text row title", { exact: true }),
		).toBeVisible();
	});

	test("should persist SDUI edits after page refresh", async ({ page }) => {
		const uniqueFlowName = `E2E SDUI Edit Flow ${Date.now()}`;
		const initialRowTitle = "Item title";
		const uniqueTitle = `E2E Test Title ${Date.now()}`;

		await createFlowInApi({
			id: crypto.randomUUID(),
			name: uniqueFlowName,
			pages: [
				{
					id: crypto.randomUUID(),
					title: "",
					rows: [
						{
							id: crypto.randomUUID(),
							type: "Text",
							source: "",
							visible: "true",
							actions: [],
							title: initialRowTitle,
						},
					],
				},
			],
		});

		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, uniqueFlowName);

		const textRow = page.getByText(initialRowTitle, { exact: true });
		await expect(textRow).toBeVisible();

		await textRow.click();

		const configPanel = getConfigPanel(page);
		const titleInput = configPanel.getByLabel("title", { exact: true });
		await expect(titleInput).toBeVisible();

		await titleInput.clear();
		await titleInput.fill(uniqueTitle);
		await expect(titleInput).toHaveText(uniqueTitle);
		await expectFlowRowTitlePersisted(uniqueFlowName, uniqueTitle);

		await page.reload();
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, uniqueFlowName);

		const editedRow = page.getByText(uniqueTitle, { exact: true });
		await expect(editedRow).toBeVisible();

		await editedRow.click();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveText(uniqueTitle);
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
			visible: "true",
			actions: [],
			title: "E2E First Child Row",
			text: "First child text",
			sheet: {
				id: crypto.randomUUID(),
				type: "Text",
				source: "",
				visible: "true",
				actions: [],
				title: "E2E Second Child Row",
				text: "Second child text",
				sheet: {
					id: crypto.randomUUID(),
					type: "Text",
					source: "",
					visible: "true",
					actions: [],
					title: "E2E Third Child Row",
					text: "Third child text",
				},
			},
		};
		const parentRow: UI_Row = {
			id: crypto.randomUUID(),
			type: "Text",
			source: "",
			visible: "true",
			actions: [],
			title: "E2E Parent Row",
			subtitle: "Parent subtitle",
			icon: "",
			sheet: firstChild,
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

		let childPages = page.getByTestId("sheet-page");
		await expect(childPages).toHaveCount(1);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(2);

		await childPages
			.nth(0)
			.getByText("E2E First Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("sheet-page");
		await expect(childPages).toHaveCount(2);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages
				.nth(1)
				.getByText("E2E Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(3);

		await childPages
			.nth(1)
			.getByText("E2E Second Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("sheet-page");
		await expect(childPages).toHaveCount(3);
		await expect(
			childPages.nth(0).getByText("E2E First Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages
				.nth(1)
				.getByText("E2E Second Child Row", { exact: true }),
		).toBeVisible();
		await expect(
			childPages.nth(2).getByText("E2E Third Child Row", { exact: true }),
		).toBeVisible();
		await expect(page.getByTestId("blank-sheet-page")).not.toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(4);

		await childPages
			.nth(2)
			.getByText("E2E Third Child Row", { exact: true })
			.click();

		childPages = page.getByTestId("sheet-page");
		await expect(childPages).toHaveCount(3);
		await expect(page.getByTestId("blank-sheet-page")).toBeVisible();
		await expect(page.locator(SELECTORS.phoneContainer)).toHaveCount(5);
		await expectFlowRowTitlePersisted(
			uniqueFlowName,
			"E2E Third Child Row",
		);
	});

	test("should display footer row when page has one", async ({ page }) => {
		const uniqueFlowName = `E2E Footer Flow ${Date.now()}`;
		const footerLabel = "E2E Footer Button";

		await createFlowInApi({
			id: crypto.randomUUID(),
			name: uniqueFlowName,
			pages: [
				{
					id: crypto.randomUUID(),
					title: "E2E Footer Page",
					rows: [],
					footer: {
						id: crypto.randomUUID(),
						type: "Button",
						source: "",
						visible: "true",
						destination: "",
						actions: [],
						title: "",
						label: footerLabel,
					},
				},
			],
		});

		await page.goto("/");
		await waitForAppLoaded(page);

		await selectFlowByLabel(page, uniqueFlowName);
		await expect(page.locator(SELECTORS.flowSelector)).not.toHaveAttribute(
			"data-value",
			"",
		);

		const footerButton = getFirstPage(page)
			.getByRole("button", { name: footerLabel })
			.first();
		await expect(footerButton).toBeVisible();
	});
});
