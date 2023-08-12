import { PrismaClient } from '@prisma/client';
import type { Device, OS } from '@prisma/client';

const prisma = new PrismaClient();
export const activeDeviceTokens: string[] = [];

const validOSes: string[] = ['ios', 'android'];

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
    if (!os || !validOSes.includes(os)) return false;

    const device = await findOrCreateDevice(token, os).catch(() => false);
    if (!device) return false

    activeDeviceTokens.push(token);
    return true;
}
