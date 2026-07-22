UPDATE "Data"
SET
	data = CASE
		WHEN jsonb_typeof(data) = 'string' THEN
			to_jsonb(
				jsonb_set(
					(data #>> '{}')::jsonb,
					'{status}',
					'"pending"'::jsonb,
					true
				)::text
			)
		ELSE
			jsonb_set(
				data,
				'{status}',
				'"pending"'::jsonb,
				true
			)
	END,
	updated_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE resource = '000c2d05-851e-4456-8f22-bb1e54f17c8c'
	AND CASE
		WHEN jsonb_typeof(data) = 'object' THEN
			NOT (data ? 'status')
		WHEN jsonb_typeof(data) = 'string'
			AND (data #>> '{}') ~ '^\s*\{' THEN
			NOT (((data #>> '{}')::jsonb) ? 'status')
		ELSE
			false
	END;
