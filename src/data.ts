import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const deviceTokens: string[] = [];

const validOSes: string[] = ['ios', 'android'];

async function primeDevicesCache(): Promise<void>
{
    const dbDevices = await prisma.device.findMany();
    deviceTokens.push(...dbDevices.map(d => d.token));

    console.info(`Primed cache with ${deviceTokens.length} device tokens`);
}
async function registerDevice(token: string, os: string): Promise<void>
{
    await prisma.device.create({
        data: {
            id: uuidv4(),
            token,
            os,
            created_at: new Date(),
            updated_at: new Date()
        }
    });
    deviceTokens.push(token);
}
export function validateAuth(token: string, os: string): boolean
{
    if (!token || token.length < 1) return false;
    if (!os || !validOSes.includes(os)) return false;

    if (!deviceTokens.includes(token))
    {
        // Yes this is odd, but rpc-json isn't async
        // so we just have to trigger this and hope it works
        registerDevice(token, os);
    }

    return true;
}

primeDevicesCache();