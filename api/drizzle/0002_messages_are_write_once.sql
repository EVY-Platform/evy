-- A message's whole lifecycle is now `data.value` over `createdAt`. Withdrawing a request is
-- another message saying "cancel", not a mutation of the request, so `archived_at` has nothing
-- left to say - and `Message` becomes write-once: nothing in the system updates one any more.
--
-- Same jsonb wrinkle as 0001: the `bun-sql` driver stores a jsonb column by JSON-stringifying
-- it, so a row written by the running API holds a jsonb *string* rather than the object.
-- `data ->> 'key'` is NULL on that shape, so every read below unwraps first and writes the
-- normalised object back.

-- An archived request with nothing answering it was withdrawn, so record that as a message.
-- Answering used to archive the request too, which is why the absence of an answer is what
-- distinguishes the two - an archived request that *was* answered needs no cancel.
INSERT INTO "Message" (id, fk, service, resource, created_at, updated_at, data, visibility)
SELECT
	gen_random_uuid(),
	m.fk,
	m.service,
	m.resource,
	m.archived_at,
	m.archived_at,
	jsonb_set(
		(CASE
			WHEN jsonb_typeof(m.data) = 'object' THEN m.data
			WHEN jsonb_typeof(m.data) = 'string' AND left(m.data #>> '{}', 1) = '{'
				THEN (m.data #>> '{}')::jsonb
			ELSE '{}'::jsonb
		END),
		'{value}',
		'"cancel"'
	) || jsonb_build_object('message_id', m.id::text),
	m.visibility
FROM "Message" m
WHERE m.archived_at IS NOT NULL
	AND m.deleted_at IS NULL
	AND NOT EXISTS (
		SELECT 1
		FROM "Message" r
		WHERE (CASE
			WHEN jsonb_typeof(r.data) = 'object' THEN r.data
			WHEN jsonb_typeof(r.data) = 'string' AND left(r.data #>> '{}', 1) = '{'
				THEN (r.data #>> '{}')::jsonb
			ELSE '{}'::jsonb
		END) ->> 'message_id' = m.id::text
	);
--> statement-breakpoint
ALTER TABLE "Message" DROP COLUMN "archived_at";
