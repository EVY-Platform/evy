import dotenv from 'dotenv';
dotenv.config();

import { validateAuth } from './data.js';
import { initServer, IRPCMethodParams } from './ws.js';

function authHandler(params: IRPCMethodParams): boolean
{
    return validateAuth(params.token, params.os);
}

async function main()
{
    console.log('Checking that the action worked!');
    await initServer({ namespace: 'admin', authHandler });
}

main();
