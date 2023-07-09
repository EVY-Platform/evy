import dotenv from 'dotenv';
dotenv.config();

import { validateAuth } from './data.js';
import { initServer, WSParams } from './ws.js';

function authHandler(params: WSParams): boolean
{
    return validateAuth(params.token, params.os);
}

async function main()
{
    await initServer({ namespace: 'admin', authHandler });
}

main();
