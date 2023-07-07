import dotenv from 'dotenv';
dotenv.config();
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Device } from '@prisma/client';
import { initServer, IRPCMethodParams } from './ws/ws.js';

const HOST: string | undefined = process.env.API_HOST;
const PORT: string | undefined = process.env.API_PORT;

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
    const newDevice: Device = await prisma.device.create({
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
function authHandler(params: IRPCMethodParams): boolean
{
    if (!params.token || params.token.length < 1) return false;
    if (!params.os || !validOSes.includes(params.os)) return false;

    if (!deviceTokens.includes(params.token))
    {
        // Yes this is odd, but rpc-json isn't async
        // so we just have to trigger this and hope it works
        registerDevice(params.token, params.os);
    }

    return true;
}

async function main()
{
    if (!HOST || !PORT) return Promise.reject(new Error('Missing API environment variables'));
    await primeDevicesCache();
    await initServer({ host: HOST, port: Number(PORT), namespace: 'admin', authHandler });
}

main()
    .then(async () =>
    {
        await prisma.$disconnect();
    })
    .catch(async (e) =>
    {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
