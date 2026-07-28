-- Messages are private records: one reaches only its creator and its recipient,
-- and on iOS the private store is part of what a device declares as owned.
ALTER TABLE "Message" ALTER COLUMN "visibility" SET DEFAULT 'private';--> statement-breakpoint
-- Existing rows are public, so no device would own them. `updated_at` is bumped
-- with them so an entitled device re-receives the row and moves it out of its
-- public store. The format has to match what the API writes (`toISOString()`),
-- because sync compares these values as strings.
UPDATE "Message"
SET
	"visibility" = 'private',
	"updated_at" = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE "visibility" = 'public';
