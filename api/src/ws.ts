import { Server, IRPCError, IRPCMethodParams } from 'rpc-websockets';

type WSServer = typeof Server;
type WSError = typeof IRPCError;
export type WSParams = typeof IRPCMethodParams;

if (!process.env.API_PORT) throw new Error('Missing API_PORT environment variable');
const PORT: number = parseInt(process.env.API_PORT);
const HOST: string = "0.0.0.0";

function initServer(authHandler: (params: WSParams) => Promise<boolean>): Promise<WSServer>
{
    return new Promise<WSServer>((resolve, reject) =>
    {
        const server = new Server({ host: HOST, port: PORT });

        server.on("listening", () => resolve(server));
        server.on("error", (error: WSError) => reject(error));
    }).then(server =>
    {
        server.setAuth(authHandler);
        console.info(`WS server listening at ${HOST}:${PORT}`);
        return server;
    });
}

export { initServer };