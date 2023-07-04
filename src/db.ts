import { Surreal } from "surrealdb.js";

const HOST: string | undefined = process.env.FRODO_SURREALDB_HOST;
const PORT: string | undefined = process.env.FRODO_SURREALDB_PORT;
const DB: string | undefined = process.env.FRODO_SURREALDB_DATABASE;
const NS: string | undefined = process.env.FRODO_SURREALDB_NAMESPACE;
const USER: string | undefined = process.env.FRODO_SURREALDB_USERNAME;
const PASS: string | undefined = process.env.FRODO_SURREALDB_PASSWORD;
if (!HOST || !PORT || !DB || !NS || !USER || !PASS)
{
    throw new Error('Missing SurrealDB environment variables');
}

const db = new Surreal(`http://${HOST}:${PORT}/rpc`);
await db.signin({ user: USER, pass: PASS });
await db.use({ ns: NS, db: DB });

export async function createUser()
{
    return await db.create("person", {
        title: 'Founder & CEO',
        name: {
            first: 'Tobie',
            last: 'Morgan Hitchcock',
        },
        marketing: true,
        identifier: Math.random().toString(36).slice(2, 12),
    });
}

export async function updateUser()
{
    return await db.update("person:jaime", {
        marketing: true,
    });
}

export async function findUser()
{
    return await db.select("person");
}
