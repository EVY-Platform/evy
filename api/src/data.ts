import { v4 as uuidv4 } from "uuid";
import { Prisma, PrismaClient, OS } from "@prisma/client";
import type { Service, Organization, ServiceProvider } from "@prisma/client";

import { isCorrectDate } from "./utils.js";
import { prismaCRUD } from "./prismaCRUD.js";

// Mock flows data for development
const mockFlows = [
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

const isDev = process.env.NODE_ENV !== "production";

type Model = Service | Organization | ServiceProvider;
type ModelsDictionary = {
	[key: string]: Model[];
};
type AnyData = {
	[key: string]: AnyData | string | number | boolean | Date;
};
enum CRUD {
	find = "find",
	create = "create",
	update = "update",
	delete = "delete",
}

const prisma = new PrismaClient({
	log: ["query", "info", "warn", "error"],
});
const lastTableDataUpdates: {
	[key: string]: Date;
} = {};

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!Object.values(OS).includes(os)) return false;

	return !!(await prisma.device
		.upsert({
			where: {
				token: token,
			},
			create: {
				token,
				os,
				created_at: new Date(),
			},
			update: {},
		})
		.catch(() => false));
}

export async function crud(
	method: CRUD,
	model: string,
	filter?: AnyData,
	data?: AnyData,
): Promise<Model[]> {
	if (!method || !(method in CRUD)) throw new Error("Invalid CRUD method");
	if (!lastTableDataUpdates[model]) {
		throw new Error("Invalid model provided");
	}
	if (!data || Object.keys(data).length < 1) {
		if (method === CRUD.create) throw new Error("No data provided");
		if (method === CRUD.update) throw new Error("No data provided");
	}
	if (!filter || Object.keys(filter).length < 1) {
		if (method === CRUD.find) throw new Error("No filter provided");
		if (method === CRUD.update) throw new Error("No filter provided");
		if (method === CRUD.delete) throw new Error("No filter provided");
	}

	let promise;
	if (method === CRUD.find) {
		promise = prismaCRUD(prisma, model, "findMany", { where: filter });
	} else if (method === CRUD.create) {
		promise = prismaCRUD(prisma, model, method, {
			data: {
				id: uuidv4(),
				...data,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});
	} else if (method === CRUD.update) {
		promise = prismaCRUD(prisma, model, method, {
			where: filter,
			data: { ...data, updated_at: new Date() },
		});
	} else if (method === CRUD.delete) {
		promise = prismaCRUD(prisma, model, method, {
			where: filter,
		});
	}

	return await promise;
}

export async function getNewDataSince(
	since?: Date,
): Promise<ModelsDictionary | typeof mockFlows> {
	// In dev mode, return mock flows data
	if (isDev) return mockFlows;

	const hasValidSince = since && isCorrectDate(new Date(since));
	const relevantTables = Object.keys(lastTableDataUpdates).filter(
		(model: string) => {
			if (!hasValidSince) return true;
			return lastTableDataUpdates[model] > since;
		},
	);

	return Promise.all(
		relevantTables.map(async (model: string) => {
			return prismaCRUD(prisma, model, "findMany", {
				...(hasValidSince && {
					where: {
						updated_at: { gt: new Date(since) },
					},
				}),
			});
		}),
	).then((res: Model[][]) => {
		return relevantTables.reduce((obj, tableName, index) => {
			obj[tableName] = res[index];
			return obj;
		}, {} as ModelsDictionary);
	});
}

export async function primeData() {
	await Promise.all(
		Object.keys(Prisma.ModelName)
			.filter((model: string) => model !== "Device")
			.map(async (model: string) => {
				const lastUpdate = await prismaCRUD(
					prisma,
					model,
					"findFirst",
					{
						select: {
							updated_at: true,
						},
						orderBy: {
							updated_at: "desc",
						},
						take: 1,
					},
				);
				lastTableDataUpdates[model] =
					lastUpdate && lastUpdate["updated_at"];
			}),
	);
}
