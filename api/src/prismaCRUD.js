export function prismaCRUD(prisma, model, method, data) {
	return prisma[model][method](data).catch((e) => {
		if (e.code) throw new Error(e.code);
		if (e.message.includes("is missing")) throw new Error(e.message);
		throw new Error(e);
	});
}
