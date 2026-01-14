import type { PrismaClient } from "@prisma/client";

export function prismaCRUD(
	prisma: PrismaClient,
	model: string,
	method: string,
	data: Record<string, unknown>,
) {
	// biome-ignore lint/suspicious/noExplicitAny: Prisma dynamic model access requires any
	return (prisma[model] as any)[method](data).catch((e: { code?: string; message?: string }) => {
		if (e.code) throw new Error(e.code);
		if (e.message?.includes("is missing")) throw new Error(e.message);
		throw new Error(String(e));
	});
}
