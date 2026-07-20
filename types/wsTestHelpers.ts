/**
 * Shared WebSocket/DB test helpers for api and marketplace test suites.
 * Dev-only: consumers import this from tests, never from runtime code.
 */
import { createServer } from "node:net";
import { PGlite, type PGliteOptions } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Client } from "rpc-websockets";

const DEFAULT_OPEN_TIMEOUT_MS = 8000;

export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (!addr || typeof addr === "string") {
				server.close();
				reject(new Error("Could not get free port"));
				return;
			}
			const port = addr.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

export function waitForClientOpen(
	ws: InstanceType<typeof Client>,
	timeoutMs = DEFAULT_OPEN_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const onOpen = () => {
			clearTimeout(timeout);
			ws.removeListener("error", onError);
			resolve();
		};
		const onError = (err: Error) => {
			clearTimeout(timeout);
			ws.removeListener("open", onOpen);
			reject(err);
		};
		const timeout = setTimeout(() => {
			ws.removeListener("open", onOpen);
			ws.removeListener("error", onError);
			reject(new Error("WebSocket connection timeout"));
		}, timeoutMs);
		ws.on("open", onOpen);
		ws.on("error", onError);
	});
}

export function createPgliteTestDatabase<
	TSchema extends Record<string, unknown>,
>(
	schema: TSchema,
	extensions?: PGliteOptions["extensions"],
): {
	pgliteClient: PGlite;
	testDb: PgliteDatabase<TSchema>;
} {
	const pgliteClient = new PGlite(extensions ? { extensions } : {});
	const testDb = drizzle(pgliteClient, { schema });
	return { pgliteClient, testDb };
}
