import type { ServerFlow } from "../app/registry.tsx";
import type { Page } from "@playwright/test";

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
				title: "Create listing",
				rows: [
					{
						type: "ColumnContainer",
						view: {
							content: {
								title: "Dimensions (width x height x depth)",
								children: [
									{
										type: "Input",
										view: {
											content: {
												title: "",
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
												title: "",
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
												title: "",
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
								title: "Dimensions (width x height x depth)",
								children: [
									{
										type: "Input",
										view: {
											content: {
												title: "",
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
												title: "",
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
												title: "",
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
								title: "",
								segments: ["Width", "Height", "Length"],
								children: [
									{
										type: "Input",
										view: {
											content: {
												title: "",
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
												title: "",
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
												title: "",
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
