import type { Locator, Page } from "@playwright/test";
import type {
	SDUI_Flow as ServerFlow,
	SDUI_Row as ServerRow,
	SDUI_RowContent as ServerRowContent,
	SDUI_RowEdit as RowEdit,
	SDUI_RowAction as RowActionConfig,
} from "evy-types/sdui/evy";

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
	type: string;
	view: {
		content: ServerRowInputContent;
		data?: string;
		max_lines?: string;
	};
	edit?: RowEdit;
	action?: RowActionConfig;
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
	configPanel: 'div:has(> span:text-is("Configuration"))',
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

export function getSDUISelector(page: Page): Locator {
	return page.locator(SELECTORS.flowSelector);
}

export function getConfigPanel(page: Page): Locator {
	return page.getByText("Configuration", { exact: true }).locator("..");
}

export function getConfigInput(page: Page, label: string): Locator {
	return getConfigPanel(page).getByLabel(label);
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
		edit: row.edit,
		action: row.action,
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

interface DebugFlowInput {
	id?: string;
	name: string;
	type: "read" | "create";
	data: string;
	pages: ServerPageInput[];
}

function createDebugFlows(): ServerFlow[] {
	const flows: DebugFlowInput[] = [
		{
			name: "First flow!",
			type: "create",
			data: "",
			pages: [
				{
					id: "step_1",
					title: "Step 1",
					rows: [
						{
							type: "ColumnContainer",
							view: {
								content: {
									title: "Dimensions 1",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "Width 1",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination: "{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Height 1",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Length 1",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination: "{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
						{
							type: "ListContainer",
							view: {
								content: {
									title: "Dimensions 2",
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "Width 2",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination: "{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Height 2",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Length 2",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination: "{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
					],
				},
				{
					id: "step_2",
					title: "Step 2",
					rows: [
						{
							type: "SelectSegmentContainer",
							view: {
								content: {
									title: "Dimensions 3",
									segments: ["Width", "Height", "Length"],
									children: [
										{
											type: "Input",
											view: {
												content: {
													title: "Width 3",
													value: "width",
													placeholder: "Width",
												},
											},
											edit: {
												destination: "{item.dimensions.width}",
												validation: {
													required: "true",
													message: "Width",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Height 3",
													value: "height",
													placeholder: "Height",
												},
											},
											edit: {
												destination: "height",
												validation: {
													required: "true",
													message: "Height",
												},
											},
										},
										{
											type: "Input",
											view: {
												content: {
													title: "Length 3",
													value: "length",
													placeholder: "Length",
												},
											},
											edit: {
												destination: "{item.dimensions.length}",
												validation: {
													required: "true",
													message: "Length",
													minValue: "1",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
						{
							type: "SelectSegmentContainer",
							view: {
								content: {
									title: "Dimensions 4",
									segments: ["List", "Info"],
									children: [
										{
											type: "ListContainer",
											view: {
												content: {
													title: "Dimensions (width x height x depth)",
													children: [
														{
															type: "Input",
															view: {
																content: {
																	title: "Width 4",
																	value: "width",
																	placeholder: "Width",
																},
															},
															edit: {
																destination: "{item.dimensions.width}",
																validation: {
																	required: "true",
																	message: "Width",
																},
															},
														},
														{
															type: "Input",
															view: {
																content: {
																	title: "Height 4",
																	value: "height",
																	placeholder: "Height",
																},
															},
															edit: {
																destination: "height",
																validation: {
																	required: "true",
																	message: "Height",
																},
															},
														},
														{
															type: "Input",
															view: {
																content: {
																	title: "Length 4",
																	value: "length",
																	placeholder: "Length",
																},
															},
															edit: {
																destination: "{item.dimensions.length}",
																validation: {
																	required: "true",
																	message: "Length",
																	minValue: "1",
																},
															},
														},
													],
												},
											},
											edit: {
												validation: {
													required: "true",
													minAmount: "3",
												},
											},
										},
										{
											type: "Info",
											view: {
												content: {
													title: "Info row title",
													text: "Info row info",
												},
											},
										},
									],
								},
							},
							edit: {
								validation: {
									required: "true",
									minAmount: "3",
								},
							},
						},
					],
				},
			],
		},
		{
			name: "Second flow",
			type: "create",
			data: "",
			pages: [
				{
					id: "step_2_1",
					title: "Step 1",
					rows: [],
				},
			],
		},
	];

	// Add IDs to all flows, pages, and rows recursively
	return flows.map((flow) => ({
		id: flow.id ?? crypto.randomUUID(),
		name: flow.name,
		type: flow.type,
		data: flow.data,
		pages: flow.pages.map((page) => ({
			id: page.id ?? crypto.randomUUID(),
			title: page.title,
			rows: ensureRowIds(page.rows ?? []),
			footer: page.footer ? ensureRowId(page.footer) : undefined,
		})),
	}));
}

export const debugFlows: ServerFlow[] = createDebugFlows();
