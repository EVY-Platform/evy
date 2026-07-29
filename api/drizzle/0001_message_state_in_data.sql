-- A message's state moves from the `status` column into `data.value`: "pending" on a
-- request, "accept" or "reject" on the response that answers one. A decision is now its
-- own message rather than a rewrite of the one that asked, so `status` has nothing left
-- to say.
--
-- `DATA_EVY_Message` is `additionalProperties: false`, so a payload still carrying
-- `status` is rejected rather than ignored - and iOS `EVY.update` echoes the whole record
-- back. That makes the `updated_at` bump below load-bearing: it is what makes every
-- entitled device re-receive these rows without the column and overwrite its local copy,
-- instead of failing its next write on a stale one.

-- A wrinkle these statements have to cope with: the `bun-sql` driver stores a jsonb column
-- by JSON-stringifying its value, so a row written by the running API holds a jsonb
-- *string* containing the object rather than the object. Reads are symmetric, so
-- JavaScript never notices - but `data ->> 'key'` is NULL on that shape and `jsonb_set`
-- refuses it outright ("cannot set path in scalar"). Every statement below therefore
-- unwraps first, and writes the normalised object back: the driver decodes an object just
-- as happily, so normalising is safe and leaves SQL able to read `data` directly.
-- Newly written rows will be strings again until the write path is fixed, which is why
-- `messages.ts` still reads `data` tolerantly.

-- An accepted request becomes a pending request plus a separate accept response. This is
-- the only statement here that inserts: the old vocabulary maps onto the new one
-- asymmetrically, because "accepted" was a fact about two parties stored in one row.
INSERT INTO "Message" (id, fk, service, resource, created_at, updated_at, status, data, visibility)
SELECT
	gen_random_uuid(),
	fk,
	service,
	resource,
	updated_at,
	updated_at,
	'pending',
	jsonb_build_object(
		'message_id', id::text,
		'value', 'accept',
		'type', (CASE
			WHEN jsonb_typeof(data) = 'object' THEN data
			WHEN jsonb_typeof(data) = 'string' AND left(data #>> '{}', 1) = '{'
				THEN (data #>> '{}')::jsonb
			ELSE '{}'::jsonb
		END) ->> 'type'
	),
	visibility
FROM "Message"
WHERE status = 'accepted' AND deleted_at IS NULL;
--> statement-breakpoint
-- Every request states its own state, and an already-answered one is closed out the same
-- way a cancellation closes one. `updated_at` moves strictly forward so the bump survives
-- a row whose timestamp is already ahead of the migration clock.
UPDATE "Message"
SET
	data = jsonb_set(
		(CASE
			WHEN jsonb_typeof(data) = 'object' THEN data
			WHEN jsonb_typeof(data) = 'string' AND left(data #>> '{}', 1) = '{'
				THEN (data #>> '{}')::jsonb
			ELSE '{}'::jsonb
		END),
		'{value}',
		'"pending"'
	),
	archived_at = CASE WHEN status = 'accepted' THEN updated_at ELSE archived_at END,
	updated_at = to_char(
		GREATEST(
			now() AT TIME ZONE 'UTC',
			(updated_at)::timestamp + interval '1 millisecond'
		),
		'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
	)
WHERE (CASE
	WHEN jsonb_typeof(data) = 'object' THEN data
	WHEN jsonb_typeof(data) = 'string' AND left(data #>> '{}', 1) = '{'
		THEN (data #>> '{}')::jsonb
	ELSE '{}'::jsonb
END) ->> 'value' IS NULL;
--> statement-breakpoint
ALTER TABLE "Message" DROP COLUMN "status";
