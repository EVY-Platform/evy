import { v4 as uuidv4 } from "uuid";
import { Prisma, PrismaClient, OS } from "@prisma/client";
import type { Service, Organization, ServiceProvider } from "@prisma/client";

const prisma = new PrismaClient();

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) return false;
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
				updated_at: new Date(),
			},
			update: {},
		})
		.catch(() => false));
}

export async function createService(service: Service): Promise<Service> {
	return prisma.service
		.create({
			data: {
				id: uuidv4(),
				name: service.name,
				description: service.description,
				created_at: new Date(),
				updated_at: new Date(),
			},
		})
		.catch((e) => {
			throw new Error(e.code);
		});
}
export async function createOrganization(
	organization: Organization,
): Promise<Organization> {
	return prisma.organization
		.create({
			data: {
				id: uuidv4(),
				name: organization.name,
				description: organization.description,
				logo: organization.logo,
				url: organization.url,
				support_email: organization.support_email,
				created_at: new Date(),
				updated_at: new Date(),
			},
		})
		.catch((e) => {
			throw new Error(e.code);
		});
}
export async function createServiceProvider(
	serviceProvider: ServiceProvider,
): Promise<ServiceProvider> {
	return prisma.serviceProvider
		.create({
			data: {
				id: uuidv4(),
				fk_service_id: serviceProvider.fk_service_id,
				fk_organization_id: serviceProvider.fk_organization_id,
				name: serviceProvider.name,
				description: serviceProvider.description,
				logo: serviceProvider.logo,
				url: serviceProvider.url,
				created_at: new Date(),
				updated_at: new Date(),
			},
		})
		.catch((e) => {
			throw new Error(e.code);
		});
}

export async function fetchServicesData(since?: Date): Promise<Service[]> {
	return await prisma.service
		.findMany({
			...(since && {
				where: {
					updated_at: { gt: since },
				},
			}),
			include: {
				providers: {
					include: {
						organization: true,
					},
				},
			},
		})
		.catch((e) => {
			throw new Error(e.code);
		});
}
