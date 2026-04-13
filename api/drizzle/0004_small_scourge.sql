-- Store instants as ISO 8601 / RFC 3339 text (UTC with Z), not Postgres timestamp.
ALTER TABLE "Data" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Data" ALTER COLUMN "updated_at" SET DATA TYPE text USING (to_char(("updated_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Device" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Flow" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Flow" ALTER COLUMN "updated_at" SET DATA TYPE text USING (to_char(("updated_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Organization" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Organization" ALTER COLUMN "updated_at" SET DATA TYPE text USING (to_char(("updated_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Service" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "Service" ALTER COLUMN "updated_at" SET DATA TYPE text USING (to_char(("updated_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "ServiceProvider" ALTER COLUMN "created_at" SET DATA TYPE text USING (to_char(("created_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));--> statement-breakpoint
ALTER TABLE "ServiceProvider" ALTER COLUMN "updated_at" SET DATA TYPE text USING (to_char(("updated_at" AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
