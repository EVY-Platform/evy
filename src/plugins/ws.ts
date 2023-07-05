import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';

type WSClientMap = {
    [key: string]: WebSocket;
};
const wsClients: WSClientMap = {};

async function ws(app: FastifyInstance)
{
    app.decorate('WS_CLIENTS', wsClients);

    app.register(websocket);
    app.register(async function (fastify)
    {
        fastify.addHook('preValidation', async (request, reply) =>
        {
            if (!request.headers["token"])
            {
                reply.code(401).send("Authentication required");
            }
            else if (['test'].indexOf(request.headers["token"].toString()) > -1)
            {
                reply.code(403).send("Authentication invalid");
            }
        });

        fastify.get('/ws', { websocket: true }, (connection, req) =>
        {
            const token = String(req.headers["token"]);
            wsClients[token] = connection.socket;

            connection.socket.on('message', message =>
            {
                sendMessage(message.toString());
            });

            connection.socket.on('close', () =>
            {
                delete wsClients[token];
            });
        });
    });

    function sendMessage(message: string)
    {
        Object.values(wsClients).forEach(client => client.send(message));
    }
}

export default fp(ws, {
    name: 'ws'
});