import 'dotenv/config';
import { findUser, updateUser, createUser } from './db.js';
import Fastify, { FastifyInstance } from 'fastify';

const HOST: string | undefined = process.env.FRODO_API_HOST;
const PORT: string | undefined = process.env.FRODO_API_PORT;
if (!HOST || !PORT) throw new Error('Missing SurrealDB environment variables');

const fastify: FastifyInstance = Fastify({
    logger: true
});

fastify.get('/', async (request, reply) =>
{
    return findUser();
});

fastify.put('/', async (request, reply) =>
{
    return updateUser();
});

fastify.post('/', async (request, reply) =>
{
    return createUser();
});

fastify.get('/health', async (request, reply) =>
{
    return 'OK';
});

fastify.listen({ host: HOST, port: parseInt(PORT) }, (err, address) =>
{
    if (err)
    {
        fastify.log.error(err);
        process.exit(1);
    }
});