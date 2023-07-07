import { Server } from 'rpc-websockets';

export interface IRPCMethodParams
{
    [x: string]: any;
}

const HOST: string | undefined = process.env.API_HOST;
const PORT: string | undefined = process.env.API_PORT;
if (!HOST || !PORT) throw new Error('Missing API environment variables');

interface WSServerOptions
{
    namespace: string;
    authHandler: (params: IRPCMethodParams) => boolean;
}

function initServer(options: WSServerOptions): Promise<void>
{
    const { namespace, authHandler } = options;
    return new Promise<Server>((resolve, reject) =>
    {
        const server = new Server({ host: HOST, port: Number(PORT), namespace });

        server.on("listening", () => resolve(server));
        server.on("error", (error) => reject(error));
    }).then(server =>
    {
        server.setAuth(authHandler);

        console.info(`${namespace} server listening on ${HOST}:${PORT}`);
    });
}

export { initServer };