import { Server, IRPCError, IRPCMethodParams } from 'rpc-websockets';

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

const HOST: string | undefined = process.env.API_HOST;
const PORT: string | undefined = process.env.API_PORT;
if (!HOST || !PORT) throw new Error('Missing API environment variables');

interface WSServerOptions
{
    namespace: string;
    authHandler: (params: WSParams) => boolean;
}

function initServer(options: WSServerOptions): Promise<WSServer>
{
    const { namespace, authHandler } = options;
    return new Promise<WSServer>((resolve, reject) =>
    {
        const server = new Server({ host: HOST, port: Number(PORT), namespace });

        server.on("listening", () => resolve(server));
        server.on("error", (error: WSError) => reject(error));
    }).then(server =>
    {
        server.setAuth(authHandler);

        console.info(`${namespace} server listening on ${HOST}:${PORT}`);

        return server;
    });
}

export { initServer };