import type { Locator, Page } from "@playwright/test";
import type { ServerFlow } from "../app/registry.tsx";

// Common selectors used across tests
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
	target: Locator
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

export const debugFlows: ServerFlow[] = [
	{
		id: "flow-1",
		name: "First flow!",
		type: "write",
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
											destination:
												"{item.dimensions.width}",
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
											destination:
												"{item.dimensions.length}",
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
											destination:
												"{item.dimensions.width}",
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
											destination:
												"{item.dimensions.length}",
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
											destination:
												"{item.dimensions.width}",
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
											destination:
												"{item.dimensions.length}",
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
																placeholder:
																	"Width",
															},
														},
														edit: {
															destination:
																"{item.dimensions.width}",
															validation: {
																required:
																	"true",
																message:
																	"Width",
															},
														},
													},
													{
														type: "Input",
														view: {
															content: {
																title: "Height 4",
																value: "height",
																placeholder:
																	"Height",
															},
														},
														edit: {
															destination:
																"height",
															validation: {
																required:
																	"true",
																message:
																	"Height",
															},
														},
													},
													{
														type: "Input",
														view: {
															content: {
																title: "Length 4",
																value: "length",
																placeholder:
																	"Length",
															},
														},
														edit: {
															destination:
																"{item.dimensions.length}",
															validation: {
																required:
																	"true",
																message:
																	"Length",
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
		id: "flow-2",
		name: "Second flow",
		type: "write",
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
