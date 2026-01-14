import { PrismaClient } from "@prisma/client";
import { mockFlows } from "../src/mockFlows";

const prisma = new PrismaClient();

async function main() {
	console.log("Seeding database with mock flows...");

	for (const flow of mockFlows) {
		const { id, ...flowData } = flow;

		// Check if flow already exists by name (to avoid duplicates on re-seed)
		const existingFlow = await prisma.flow.findFirst({
			where: {
				data: {
					path: ["name"],
					equals: flowData.name,
				},
			},
		});

		if (existingFlow) {
			console.log(`Flow "${flowData.name}" already exists, skipping...`);
			continue;
		}

		const now = new Date();
		const createdFlow = await prisma.flow.create({
			data: {
				data: flowData,
				created_at: now,
				updated_at: now,
			},
		});

		console.log(`Created flow "${flowData.name}" with id: ${createdFlow.id}`);
	}

	console.log("Seeding complete!");
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
