// Mock flows data for development
export const mockFlows = [
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
