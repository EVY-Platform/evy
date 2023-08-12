import { PrismaClient } from '@prisma/client';
import type { Device } from '@prisma/client';
import { OS } from '@prisma/client';

const prisma = new PrismaClient();

async function findOrCreateDevice(token: string, os: OS): Promise<Device|null>
{
    return prisma.device.upsert({
        where: {
            token: token
        },
        create: {
            token,
            os,
            created_at: new Date(),
            updated_at: new Date()
        },
        update: {}
    });
}

export async function validateAuth(token: string, os: OS): Promise<boolean>
{
    if (!token || token.length < 1) return false;
    if (!Object.values(OS).includes(os)) return false;

    return !!await findOrCreateDevice(token, os).catch(() => false);
}
