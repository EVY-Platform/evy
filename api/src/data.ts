import { v4 as uuidv4 } from "uuid";
import { Prisma, PrismaClient, OS } from "@prisma/client";
import type { Service, Organization, ServiceProvider } from "@prisma/client";

import { isCorrectDate } from "./utils.js";
import { prismaCRUD } from "./prismaCRUD.js";

type Model = Service | Organization | ServiceProvider;
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
const lowerCaseModels = Object.keys(Prisma.ModelName).map((n) =>
	n.toLowerCase(),
);

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
): Promise<Model[] | boolean | undefined> {
	if (!method || !(method in CRUD)) throw new Error("Invalid CRUD method");
	if (!lowerCaseModels.find((m) => m === model)) {
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
	model: string,
	since?: Date,
): Promise<Model[]> {
	if (!lowerCaseModels.find((m) => m === model)) {
		throw new Error("Invalid model provided");
	}

	const hasValidSince = since && isCorrectDate(new Date(since));
	return await prismaCRUD(prisma, model, "findMany", {
		...(hasValidSince && {
			where: {
				updated_at: { gt: new Date(since) },
			},
		}),
	});
}
