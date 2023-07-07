import dotenv from 'dotenv';
dotenv.config();

import { validateAuth } from './data.js';
import { initServer, IRPCMethodParams } from './ws.js';

const HOST: string | undefined = process.env.API_HOST;
const PORT: string | undefined = process.env.API_PORT;

function authHandler(params: IRPCMethodParams): boolean
{
    return validateAuth(params.token, params.os);
}

async function main()
{
    if (!HOST || !PORT) return Promise.reject(new Error('Missing API environment variables'));
    await initServer({ host: HOST, port: Number(PORT), namespace: 'admin', authHandler });
}

main();
