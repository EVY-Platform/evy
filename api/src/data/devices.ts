import { eq } from "drizzle-orm";

import type { OS } from "evy-types";

import {
	device,
	osEnum,
} from "../../../types/generated/ts/db/schema.generated";
import { getDb } from "./db";

export async function validateAuth(token: string, os: OS): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!osEnum.enumValues.includes(os)) return false;

	try {
		const existing = await getDb()
			.select()
			.from(device)
			.where(eq(device.token, token))
			.limit(1);

		if (existing.length > 0) {
			return true;
		}

		await getDb().insert(device).values({
			token,
			os,
			createdAt: new Date().toISOString(),
		});

		return true;
	} catch (err) {
		console.warn("validateAuth: unexpected error", err);
		return false;
	}
}
