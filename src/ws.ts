import { Server } from 'rpc-websockets';

export interface IRPCMethodParams
{
    [x: string]: any;
}

interface WSServerOptions
{
    host: string;
    port: number;
    namespace: string;
    authHandler: (params: IRPCMethodParams) => boolean;
}

function initServer(options: WSServerOptions): Promise<void>
{
    const { host, port, namespace, authHandler } = options;
    return new Promise<Server>((resolve, reject) =>
    {
        const server = new Server({ host, port, namespace });

        server.on("listening", () => resolve(server));
        server.on("error", (error) => reject(error));
    }).then(server =>
    {
        server.setAuth(authHandler);

        console.info(`${namespace} server listening on ${host}:${port}`);

        // const ns = server.of(namespace);
        // console.log(ns.clients());
    });
}

// server.register('sum', params =>
// {
//     return params[0] + params[1];
// });

// // create an event
// server.event('feedUpdated');

// // get events
// console.log(server.eventList());

// // emit an event to subscribers
// server.emit('feedUpdated');

export { initServer };