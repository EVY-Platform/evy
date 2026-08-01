ALTER TABLE "message" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "value" text;--> statement-breakpoint
UPDATE "message" SET
  "type"  = norm.d ->> 'type',
  "value" = norm.d ->> 'value'
FROM (SELECT id, CASE WHEN jsonb_typeof(data) = 'string'
                      THEN (data #>> '{}')::jsonb
                      ELSE data END AS d
      FROM "message") norm
WHERE "message".id = norm.id;--> statement-breakpoint
UPDATE "message" SET data = CASE
  WHEN jsonb_typeof(data) = 'string' THEN
    to_jsonb((data #>> '{}')::jsonb - 'type' - 'value')
  ELSE
    data - 'type' - 'value'
END;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message" ALTER COLUMN "value" SET NOT NULL;
