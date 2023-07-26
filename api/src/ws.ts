import { Server, IRPCError, IRPCMethodParams } from 'rpc-websockets';

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

const HOST: string | undefined = process.env.API_HOST;
const PORT: string | undefined = process.env.API_PORT;
if (!HOST || !PORT) throw new Error('Missing API environment variables');

function initServer(authHandler: (params: WSParams) => boolean): Promise<WSServer>
{
    return new Promise<WSServer>((resolve, reject) =>
    {
        const server = new Server({ host: HOST, port: Number(PORT) });

        server.on("listening", () => resolve(server));
        server.on("error", (error: WSError) => reject(error));
    }).then(server =>
    {
        server.setAuth(authHandler);

        console.info(`WS server listening on ${HOST}:${PORT}`);

        return server;
    });
}

export { initServer };