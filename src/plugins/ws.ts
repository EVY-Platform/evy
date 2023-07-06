import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import websocket, { SocketStream } from '@fastify/websocket';
import WebSocket from 'ws';

type WSClientMap = {
    [key: string]: WebSocket;
};
const wsClients: WSClientMap = {};

async function ws(app: FastifyInstance)
{
    app.decorate('WS_CLIENTS', wsClients);

    app.register(websocket);
    app.register(async function (fastify: any)
    {
        fastify.addHook('preValidation', async (req: FastifyRequest, rep: FastifyReply) =>
        {
            const token: string | undefined = req.headers["token"]?.toString();
            if (!token || wsClients[token])
            {
                rep.code(401).send("Authentication required");
            }
            else if (!await fastify.validateToken(token.toString()))
            {
                rep.code(403).send("Authentication invalid");
            }
        });

        fastify.get('/ws', { websocket: true }, (conn: SocketStream, req: FastifyRequest) =>
        {
            const token = String(req.headers["token"]);
            wsClients[token] = conn.socket;

            conn.socket.on('message', message =>
            {
                sendMessage(message.toString());
            });

            conn.socket.on('close', () =>
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