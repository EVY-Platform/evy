import { eq } from "drizzle-orm";
import type { OS } from "evy-types";
import { nowIso as clockNowIso } from "evy-types/clock";

import { device, os_enum } from "evy-types/db/schema.generated";
import type { EvyDb } from "../../database/db";

// Public API

export async function validateAuth(
	db: EvyDb,
	token: string,
	os: OS,
): Promise<boolean> {
	if (!token || token.length < 1) throw new Error("No token provided");
	if (!os || os.length < 1) throw new Error("No os provided");

	if (!os_enum.enumValues.includes(os)) return false;

	try {
		const existing = await db
			.select()
			.from(device)
			.where(eq(device.token, token))
			.limit(1);

		if (existing.length > 0) {
			return true;
		}

		await db.insert(device).values({
			token,
			os,
			created_at: clockNowIso(),
			visibility: "private",
		});

		return true;
	} catch (err) {
		console.warn("validateAuth: unexpected error", err);
		return false;
	}
}
