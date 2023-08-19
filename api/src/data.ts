import { v4 as uuidv4 } from "uuid";
import { Prisma, PrismaClient, OS } from "@prisma/client";
import type { Service, Organization, ServiceProvider } from "@prisma/client";

import { isCorrectDate } from "./utils.js";
import { prismaCRUD } from "./prismaCRUD.js";

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

export async function getNewDataSince(since?: Date): Promise<ModelsDictionary> {
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
				const lastUpdatedAt = await prismaCRUD(
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
				lastTableDataUpdates[model] = lastUpdatedAt["updated_at"];
			}),
	);
}
