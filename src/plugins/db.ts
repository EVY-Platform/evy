import { Surreal } from "surrealdb.js";
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

const URL: string | undefined = process.env.FRODO_SURREALDB_URL;
const DB: string | undefined = process.env.FRODO_SURREALDB_DATABASE;
const NS: string | undefined = process.env.FRODO_SURREALDB_NAMESPACE;
const USER: string | undefined = process.env.FRODO_SURREALDB_USERNAME;
const PASS: string | undefined = process.env.FRODO_SURREALDB_PASSWORD;
if (!URL || !DB || !NS || !USER || !PASS)
{
    throw new Error('Missing SurrealDB environment variables');
}

type Token = {
    id: string;
};

const client = new Surreal(URL, {
    auth: { user: USER, pass: PASS },
    ns: NS, db: DB
});

// const test = await client.create("token", {
//     created: new Date()
// });
// console.log(test);

async function validateToken(token: string): Promise<boolean>
{
    const res = await client.select<Token>(`token:${token}`);
    return res.length > 0;
}

export default fp(async (app: FastifyInstance) =>
{
    app.decorate('validateToken', validateToken);
}, {
    name: 'db'
});