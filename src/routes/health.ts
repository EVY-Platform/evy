import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

export default fp(async (app: FastifyInstance) =>
{
    app.get('/health', async () => 'Ok');
}, {
    name: 'health'
});