import 'dotenv/config';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyInstance } from 'fastify';
import autoLoad from '@fastify/autoload';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HOST: string | undefined = process.env.FRODO_API_HOST;
const PORT: string | undefined = process.env.FRODO_API_PORT;
if (!HOST || !PORT) throw new Error('Missing API environment variables');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app: FastifyInstance = Fastify({
    logger: true
}).withTypeProvider<TypeBoxTypeProvider>();

app.register(autoLoad, {
    dir: join(__dirname, 'plugins'),
    forceESM: true
});
app.register(autoLoad, {
    dir: join(__dirname, 'routes'),
    forceESM: true
});

app.listen({ host: HOST, port: parseInt(PORT) }, (err) =>
{
    if (err)
    {
        app.log.error(err);
        process.exit(1);
    }
});